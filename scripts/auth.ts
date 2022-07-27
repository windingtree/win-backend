import { importKeyPrivatePem } from '@windingtree/org.id-auth/dist/keys';
import { createAuthJWT } from '@windingtree/org.id-auth/dist/tokens';
// import { createVerificationMethodWithKey } from '@windingtree/org.json-utils';

const privatePem = ``;

(async () => {
  const privateKey = await importKeyPrivatePem(privatePem);

  const issuer =
    'did:orgid:4:0x18f79012d7a93736f7c52b7334093ccdf36aac417220bd31583b1facee5c76b7';
  const audience = '';
  const scope = '';

  const jwt = await createAuthJWT(privateKey, issuer, audience, scope);

  console.log(jwt);
})();
