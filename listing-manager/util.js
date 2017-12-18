/*
  This file contains a collection of 'utility' functions used by the listingManager.
  By modularizing the code into a series of subfunctions in this file, it makes
  each subfunciton easier to test. It also makes the code in listingManager easier
  to read, since you only have to follow the high-level calls.
*/

"use strict";

const rp = require("request-promise");

// Generate an auth key for the header.Required fall all OpenBazaar API calls.
function getOBAuth() {
  //debugger;

  const clientID = "yourUsername";
  const clientSecret = "yourPassword";

  //Encoding as per Centro API Specification.
  const combinedCredential = `${clientID}:${clientSecret}`;
  //var base64Credential = window.btoa(combinedCredential);
  const base64Credential = Buffer.from(combinedCredential).toString("base64");
  const readyCredential = `Basic ${base64Credential}`;

  return readyCredential;
}

// This function updates the expiration date of a devices devicePublicData model.
function updateExpiration(deviceId, timeSelector) {
  return new Promise(function(resolve, reject) {
    //debugger;

    let targetTime = 0;
    switch (timeSelector) {
      case 0: // Now - force device reset.
        targetTime = 0;
        break;
      case 10: // Testing
        targetTime = 60000 * 8;
        break;
      case 20: // 1 hr
        targetTime = 60000 * 60;
        break;
      case 30: // 1 day
        targetTime = 60000 * 60 * 24;
        break;
      case 40: // 1 week
        targetTime = 60000 * 60 * 24 * 7;
        break;
      case 50: // 1 month
        targetTime = 60000 * 60 * 24 * 30;
        break;
      default:
        targetTime = 0;
    }

    // Get the devicePublicData model.
    const options = {
      method: "GET",
      uri: `http://p2pvps.net/api/devicePublicData/${deviceId}`,
      json: true,
    };
    return (rp(options)
        // Update the model with a new expiration date.
        .then(function(data) {
          //debugger;
          console.log(
            `Expiration before: ${data.collection.expiration}, type: ${typeof data.collection
              .expiration}`
          );
          const now = new Date();
          const expirationDate = new Date(now.getTime() + targetTime);
          //data.collection.expiration = expirationDate.toISOString();
          data.collection.expiration = expirationDate;

          console.log(
            `Expiration after: ${data.collection.expiration}, type: ${typeof data.collection
              .expiration}`
          );

          // Update the model.
          const options = {
            method: "POST",
            uri: `http://p2pvps.net/api/devicePublicData/${deviceId}/update`,
            body: data.collection,
            json: true,
          };
          return (rp(options)
              // Return success or failure.
              .then(updatedData => {
                debugger;

                // Verify that the returned value contains the new date.
                if (updatedData.collection.expiration) return resolve(true);
                return resolve(false);
              })

              .catch(err => {
                throw err;
              }) );
        })

        .catch(err => {
          console.error("Error in updateExpiration: ", err);
          return reject(err);
        }) );
  });
}

// This function gets all the notifications from the OB server.
// It returns a Promise that resolves to an array of new notifications.
function getOBNotifications(config) {
  const options = {
    method: "GET",
    uri: "http://p2pvps.net:4002/ob/notifications",
    //body: listingData,
    json: true, // Automatically stringifies the body to JSON
    headers: {
      Authorization: config.apiCredentials,
    },
    //resolveWithFullResponse: true
  };

  return rp(options).then(function(data) {
    const allNotifications = data;
    const newNotifications = [];

    // Exit if no new notifications.
    if (allNotifications.unread === 0) return newNotifications;

    //debugger;

    // Read through all notifications and return any that are marked unread.
    for (let i = 0; i < allNotifications.notifications.length; i++) {
      if (!allNotifications.notifications[i].read)
        newNotifications.push(allNotifications.notifications[i]);
    }

    return newNotifications;
  });
}

// This function returns a devicePublicModel given the deviceId.
function getDevicePublicModel(deviceId) {
  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/devicePublicData/${deviceId}`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options).then(function(data) {
    //debugger;

    if (data.collection === undefined) throw `No devicePublicModel with ID of ${deviceId}`;

    return data.collection;
  });
}

// This function returns a devicePrivateModel given ID for the model.
function getDevicePrivateModel(privateId) {
  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/devicePrivateData/${privateId}`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options).then(function(data) {
    //debugger;

    if (data.collection === undefined) throw `No devicePrivateModel with ID of ${privateId}`;

    return data.collection;
  });
}

// This function marks an order on OB as 'Fulfilled'. It send the login information needed
// by the renter to log into the Client device.
function fulfillOBOrder(config) {
  if (config.devicePrivateData == null) return null;

  //debugger;

  const notes = `Host: p2pvps.net
Port: ${config.devicePrivateData.serverSSHPort}
Login: ${config.devicePrivateData.deviceUserName}
Password: ${config.devicePrivateData.devicePassword}
`;

  const bodyData = {
    orderId: config.obNotice.notification.orderId,
    note: notes,
  };

  const options = {
    method: "POST",
    uri: "http://p2pvps.net:4002/ob/orderfulfillment",
    body: bodyData,
    json: true, // Automatically stringifies the body to JSON
    headers: {
      Authorization: config.apiCredentials,
    },
  };

  return rp(options)
    .then(function(data) {
      //debugger;
      console.log(`OrderId ${config.obNotice.notification.orderId} has been marked as fulfilled.`);
      return true;
    })
    .catch(err => {
      debugger;
      console.log('Error trying to mark order as "Fulfilled".');
      throw err;
    });
}

// This function adds a deviceId to the rentedDevice list model.
function addRentedDevice(deviceId) {
  //debugger;

  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/rentedDevices/add/${deviceId}`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options)
    .then(function(data) {
      //debugger;

      if (!data.success) throw `Could not add device ${deviceId} to rentedDevices list model.`;

      return true;
    })
    .catch(err => {
      console.error(`Could not add device ${deviceId} to rentedDevices list model.`);
      throw err;
    });
}

// This function removes a deviceId from the rentedDevices list model
function removeRentedDevice(deviceId) {
  //debugger;

  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/rentedDevices/remove/${deviceId}`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options)
    .then(function(data) {
      //debugger;

      if (!data.success) throw `Could not remove device ${deviceId} from rentedDevices list model.`;

      return true;
    })
    .catch(err => {
      console.error(`Could not remove device ${deviceId} from rentedDevices list model.`);
      throw err;
    });
}

// This function marks a notification as read in Open Bazaar.
function markNotificationAsRead(config) {
  //debugger;

  const noteId = config.obNotice.notification.notificationId;

  const body = {
    notificationId: noteId,
  };

  const options = {
    method: "POST",
    uri: `http://p2pvps.net:4002/ob/marknotificationasread/${noteId}`,
    body: {},
    json: true, // Automatically stringifies the body to JSON
    headers: {
      Authorization: config.apiCredentials,
    },
  };

  return rp(options)
    .then(function(data) {
      //debugger;
      console.log(`Notification ${noteId} has been marked as 'read'.`);
      return true;
    })
    .catch(err => {
      debugger;
      console.log('Error trying to mark notificatioin as "Read".');
      throw err;
    });
}

// This function remove the associated listing from the OB store.
function removeOBListing(deviceData) {
  //debugger;

  const obContractId = deviceData.obContract;

  // Validation/Error Handling
  if (obContractId === undefined || obContractId === null)
    throw `no obContract model associated with device ${deviceData._id}`;

  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/ob/removeMarketListing/${obContractId}`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options)
    .then(function(data) {
      //debugger;

      if (!data.success)
        throw `Could not remove device ${obContractId} from rentedDevices list model.`;

      //console.log(
      //  `Successfully removed listing on OB store with obContract model ID ${obContractId}`
      //);
      return true;
    })
    .catch(err => {
      console.error(`Could not remove device ${obContractId} from rentedDevices list model.`);
      throw err;
    });
}

// This function returns an array of devicePublicModel IDs stored in the rentedDevices model.
function getRentedDevices() {
  //debugger;

  const options = {
    method: "GET",
    uri: `http://p2pvps.net/api/rentedDevices/list`,
    json: true, // Automatically stringifies the body to JSON
  };

  return rp(options)
    .then(function(data) {
      //debugger;

      if (!data.collection[0]) throw `Could not find a list of rented devices on server.`;

      const retVal = data.collection[0].rentedDevices;

      return retVal;
    })
    .catch(err => {
      debugger;
      console.error(`Could not retrieve the list of rented devices from the server.`);
      throw err;
    });
}

// This function returns an array of listings in the store associated with this server.
function getOBListings(config) {
  //debugger;

  const options = {
    method: "GET",
    uri: `http://p2pvps.net:4002/ob/listings`,
    json: true, // Automatically stringifies the body to JSON
    headers: {
      Authorization: config.apiCredentials,
    },
  };

  return rp(options)
    .then(function(data) {
      //debugger;
      //console.log(`Notification ${noteId} has been marked as 'read'.`);
      return data;
    })
    .catch(err => {
      debugger;
      console.log("Error trying to get store listings.");
      throw err;
    });
}

module.exports = {
  getOBAuth,
  updateExpiration,
  getOBNotifications,
  getDevicePublicModel,
  getDevicePrivateModel,
  fulfillOBOrder,
  addRentedDevice,
  removeRentedDevice,
  markNotificationAsRead,
  removeOBListing,
  getRentedDevices,
  getOBListings,
};
