export const getEasyEcomOrders = async (startDate, endDate, nextUrl)=>{
    do {
      let fetchedOrders = await easyEcomApi.getOrders(startDate, endDate, nextUrl);
      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.orders) {
        throw fetchedOrders;
      }
      orders.push(...fetchedOrders.orders);
      nextUrl = fetchedOrders.nextUrl ? fetchedOrders.nextUrl : '';

      await new Promise(resolve => setTimeout(resolve, 500)); 
    } while (nextUrl !== '');
    
}