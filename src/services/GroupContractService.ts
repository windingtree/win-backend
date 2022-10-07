import { Job } from 'bullmq';
import {
  GroupBookingRequestDBValue,
  DealStorage,
  State,
  PaymentInfo
} from '../types';
import groupBookingRequestRepository from '../repositories/GroupBookingRequestRepository';
import { constants, providers, utils, BigNumber as BN } from 'ethers';
import GroupBookingEmailService from './GroupBookingEmailService';
import JiraService from './JiraService';
import { jiraDisableNotifications } from '../config';
import { CreatedIssue } from 'jira.js/out/version3/models';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';
import { GroupBookingDeposits } from '@windingtree/glider-types/dist/win';
import { allowedNetworks, testWallet } from '../config';
import { getOwners } from '@windingtree/win-commons/dist/multisig';
import { WinPay__factory } from '@windingtree/win-pay/dist/typechain';
import DealError from '../exceptions/DealError';

// Note: exceptions here finish automatically the workers' job's attempt.
export const groupDealWorker = async (job: Job) => {
  const data: GroupBookingRequestDBValue = job.data;

  if (data.status === 'pending') {
    let paymentInfo: PaymentInfo;
    try {
      paymentInfo = await checkPaymentOnBlockchains(
        job.attemptsMade,
        data.serviceId,
        data.depositOptions
      );
      data.contract = paymentInfo.networkInfo;
      data.dealStorage = paymentInfo.dealStorage;
      data.blockchainUserAddresses = paymentInfo.blockchainUserAddresses;
      data.status = 'depositPaid';
      job.update(data);
    } catch (e) {
      if (e instanceof DealError) {
        // If the deal exist, we create the database record, even if there is an error.
        data.contract = e.networkInfo;
        data.dealStorage = e.dealStorage;
        data.blockchainUserAddresses = e.blockchainUserAddresses;
        data.errorMessage = e.message;
        data.status = 'dealError';
        await groupBookingRequestRepository.createGroupBookingRequest(data);
        job.update(data);
      }
      throw e;
    }
  }

  // Retry...
  if (data.status === 'dealError') {
    const paymentInfo = await checkPaymentOnBlockchains(
      job.attemptsMade,
      data.serviceId,
      data.depositOptions
    );
    data.contract = paymentInfo.networkInfo;
    data.dealStorage = paymentInfo.dealStorage;
    data.blockchainUserAddresses = paymentInfo.blockchainUserAddresses;
    data.status = 'depositPaid';
    await groupBookingRequestRepository.updateBlockchainInfo(
      data.requestId,
      data.status,
      data.contract,
      data.dealStorage,
      data.blockchainUserAddresses,
      ''
    );
    data.status = 'stored';
    job.update(data);
  }

  if (data.status === 'depositPaid') {
    await groupBookingRequestRepository.createGroupBookingRequest(data);
    data.status = 'stored';
    job.update(data);
  }

  // Create a Jira Ticket
  if (data.status === 'stored') {
    const ticket = await createTicket(data);
    data.jiraTicket = ticket;
    data.status = 'ticketCreated';
    job.update(data);
  }

  if (data.status === 'ticketCreated' && data.jiraTicket) {
    await groupBookingRequestRepository.updateJiraInfo(
      data.requestId,
      data.status,
      data.jiraTicket
    );
    data.status = 'ticketStored';
    job.update(data);
  }

  // Send confirmation mail
  if (data.status === 'ticketStored') {
    await sendEmail(data);
    data.status = 'emailSent';
    job.update(data);
  }

  if (data.status === 'emailSent') {
    await groupBookingRequestRepository.updateStatus(
      data.requestId,
      'complete'
    );
    data.status = 'complete';
    job.update(data);
  }
};

const checkPaymentOnBlockchains = async (
  attemptsMade: number,
  serviceId: string,
  depositOptions: GroupBookingDeposits
): Promise<PaymentInfo> => {
  if (process.env.NODE_IS_TEST === 'true') {
    const dealStorage: DealStorage = {
      asset: utils.id('some_asset'),
      customer: (await testWallet).address,
      provider: constants.AddressZero,
      state: 1,
      value: depositOptions.offerCurrency.amount
    };

    const networkInfo = allowedNetworks[0];
    const blockchainUserAddresses = [dealStorage.customer];

    if (attemptsMade === 1) {
      throw new DealError(
        'Fail to test the retry',
        networkInfo,
        dealStorage,
        blockchainUserAddresses
      );
    }

    return {
      paidCurrency: depositOptions.offerCurrency.currency,
      networkInfo,
      dealStorage,
      blockchainUserAddresses
    };
  }

  for (const network of allowedNetworks) {
    const paymentInfo = await checkPaymentOnBlockchain(
      network,
      serviceId,
      depositOptions
    );
    if (paymentInfo) return paymentInfo;
  }

  throw new Error(`No deal found on the blockchains`); // Not a deal error here, just no deal yet.
};

const checkPaymentOnBlockchain = async (
  networkInfo: NetworkInfo,
  serviceId: string,
  paymentOptions: GroupBookingDeposits
): Promise<PaymentInfo | undefined> => {
  const { rpc, chainId, contracts } = networkInfo;
  const provider = new providers.JsonRpcProvider(rpc, chainId);

  const wipPay = WinPay__factory.connect(contracts.winPay, provider);
  const deal = await wipPay.deals(serviceId); // Returns a deal with zeroes values when no deal.

  if (deal.state !== State.PAID) {
    // The network might not be the good one, or the deal is not paid yet.
    // No exception here to continue the checking of other blockchains.
    return;
  }

  const dealStorage: DealStorage = {
    asset: deal.asset,
    customer: deal.customer,
    provider: deal.provider,
    state: deal.state,
    value: deal.value.toString()
  };

  // Here the deal has been paid, so we are on the good network.

  // TODO: we could use `UnrecoverableError` here, if there is an issue below it is probably an unrecoverable one,
  // and subsequent retries would probably be useless.

  const blockchainUserAddresses = await getOwners(
    dealStorage.customer,
    provider
  );
  // if (networkInfo.mode.includes('prod')) {
  const paidCurrency = checkPaidAmount(
    networkInfo,
    dealStorage,
    paymentOptions,
    blockchainUserAddresses
  );
  return {
    paidCurrency,
    dealStorage,
    networkInfo,
    blockchainUserAddresses
  };
  // } else {
  //   const paidCurrency = checkPaidAmountTest(
  //     networkInfo,
  //     dealStorage,
  //     paymentOptions,
  //     blockchainUserAddresses
  //   );
  //   return {
  //     paidCurrency,
  //     dealStorage,
  //     networkInfo,
  //     blockchainUserAddresses
  //   };
  // }
};

// const checkPaidAmountTest = (
//   networkInfo: NetworkInfo,
//   dealStorage: DealStorage,
//   paymentOptions: GroupBookingDeposits,
//   blockchainUserAddresses: string[]
// ): string => {
//   // The specificity here is that in test, erc-20 currencies have the same smart contract address, so we start by checking the amount.

//   let currency = '';
//   const dealValue = BN.from(dealStorage.value);
//   if (
//     paymentOptions.usd &&
//     dealValue.eq(utils.parseEther(paymentOptions.usd))
//   ) {
//     currency = 'USD';
//   } else if (
//     dealValue.eq(utils.parseEther(paymentOptions.offerCurrency.amount))
//   ) {
//     currency = paymentOptions.offerCurrency.currency;
//   } else if (
//     paymentOptions.preferredCurrency &&
//     dealValue.eq(utils.parseEther(paymentOptions.preferredCurrency.amount))
//   ) {
//     currency = paymentOptions.preferredCurrency.currency;
//   }

//   if (currency === '') {
//     // The user paid the wrong amount.
//     throw new DealError(
//       `Test: wrong amount: ${dealStorage.value}`,
//       networkInfo,
//       dealStorage,
//       blockchainUserAddresses
//     );
//   }

//   const address = utils.getAddress(dealStorage.asset);
//   const asset = networkInfo.contracts.assets.find(
//     (asset) => asset.coin === address && asset.currency === currency
//   );

//   if (!asset) {
//     // The user paid the good amount but in a stablecoin that does not match the requested currency.
//     throw new DealError(
//       `Test: no stableCoin in config for ${currency}`,
//       networkInfo,
//       dealStorage,
//       blockchainUserAddresses
//     );
//   }

//   return currency;
// };

const checkPaidAmount = (
  networkInfo: NetworkInfo,
  dealStorage: DealStorage,
  paymentOptions: GroupBookingDeposits,
  blockchainUserAddresses: string[]
): string => {
  const address = utils.getAddress(dealStorage.asset);
  const asset = networkInfo.contracts.assets.find(
    (asset) => asset.coin === address
  );

  if (!asset) {
    // Here the deal has been paid but in an unsupported currency
    throw new DealError(
      `Contract: Invalid assets configuration`,
      networkInfo,
      dealStorage,
      blockchainUserAddresses
    );
  }

  const dealValue = BN.from(dealStorage.value);
  if (
    asset.currency === 'USD' &&
    paymentOptions.usd &&
    dealValue.eq(utils.parseUnits(paymentOptions.usd, asset.decimals))
  ) {
    // Success
    return asset.currency;
  }

  // Note: Might not be proposed as a payment option in the future...
  if (
    paymentOptions.offerCurrency.currency === asset.currency &&
    dealValue.eq(
      utils.parseUnits(paymentOptions.offerCurrency.amount, asset.decimals)
    )
  ) {
    return asset.currency;
  }

  if (
    paymentOptions.preferredCurrency &&
    paymentOptions.preferredCurrency.currency === asset.currency &&
    dealValue.eq(
      utils.parseUnits(paymentOptions.preferredCurrency.amount, asset.decimals)
    )
  ) {
    return asset.currency;
  }

  throw new DealError(
    `Contract: wrong amount and/or currency: ${dealStorage.value}${asset.currency}`,
    networkInfo,
    dealStorage,
    blockchainUserAddresses
  );
};

const createTicket = async (
  data: GroupBookingRequestDBValue
): Promise<CreatedIssue> => {
  if (jiraDisableNotifications === 'false') {
    const jiraService = new JiraService();
    // Exception will be raised here if Jira is down
    const response = await jiraService.createJiraTicket(
      data.rooms,
      data.contact
    );
    return response;
  } else {
    return {
      id: 'JiraDisabled',
      key: 'JiraDisabled',
      self: 'JiraDisabled'
    };
  }
};

const sendEmail = async (data: GroupBookingRequestDBValue) => {
  if (process.env.NODE_IS_TEST !== 'true') {
    const emailService = new GroupBookingEmailService();
    emailService.setMessage(
      data.rooms[0].offer.accommodation.name,
      data.requestId,
      data.contact
    );
    // Exception will be raised here if SendGrid is down
    await emailService.sendEmail();
  }
};
