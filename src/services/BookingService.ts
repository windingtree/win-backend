export class BookingService {
  public async booking() {
    //Simard pay api connect
    //derby soft proxy connect
    return true;
  }

  public async myBookings() {
    return [];
  }

  public async price(id) {
    console.log(id);

    return { price: 100, currency: 'USD' };
  }
}

export default new BookingService();
