/*
  The Listing Manager has the following responsibilities:

  * Poll the OpenBazaar (OB) store for new orders and fulfill those orders when they
  are detected.

  * Monitor Clients with listings in the OB store. Reboot them if they lose connection
  with the server, by manipulating the expiration date.

  * Monitor Clients that are actively being rented. Reboot them and generate a pro-rated
  refund if the device loses connection with the server.

  ---WIP---
  * Poll the OB store for purchases of renewal listings and increment the
  expiration date of the Client.

  * Monitor renewal listings and remove any that are unpaid after 1 hr.

  * Remove any orphaned obContract models that have reached their expiration.

*/

"use strict";

// Dependencies.
const express = require("express");
const util = require("./lib/util.js");
const openbazaar = require("./lib/openbazaar.js");

// Global Variables
const app = express();
const port = 3434;

const CHECK_OB_NOTIFICATIONS_INTERVAL = 2 * 60000; // 2 minutes
const CHECK_RENTED_DEVICES_INTERVAL = 5 * 60000; // 5 minutes
const CHECK_LISTED_DEVICES_INTERVAL = 5 * 60000; // 5 minutes

// OpenBazaar Credentials
const OB_USERNAME = "yourUsername";
const OB_PASSWORD = "yourPassword";

// Server Information
const SERVER_URL = "http://p2pvps.net";
const SERVER_PORT = "4002"; // Open Bazaar port

// Create an Express server. Future development will allow serving of webpages and creation of Client API.
const ExpressServer = require("./lib/express-server.js");
const expressServer = new ExpressServer(app, port);
expressServer.start();

// Initialize the debugging logger.
const Logger = require("./lib/logger.js");
const logr = new Logger();

// Generate api credentials for OpenBazaar.
const apiCredentials = openbazaar.getOBAuth(OB_USERNAME, OB_PASSWORD);
const config = {
  // Config object passed to library functions.
  apiCredentials: apiCredentials,
  server: SERVER_URL,
  port: SERVER_PORT,
  logr: logr, // Include a handle to the debug logger.
};

async function fulfillNewOrders() {
  try {
    // Higher scoped variables.
    let devicePublicData;
    let thisNotice; // Will not stay here. Just for testing.

    const now = new Date();
    logr.info(`Listing Manager checking for new orders at ${now}`);

    // Get NEW notifications.
    const notes = await util.getNewOBNotifications(config);

    // For now, assuming I have one order at a time.
    thisNotice = notes[0];

    // Exit if no notices were found.
    if (thisNotice === undefined) return null;

    // Exit if the notice is not for an order.
    if (thisNotice.notification.type !== "order") return null;

    // Get device ID from the listing
    const tmp = thisNotice.notification.slug.split("-");
    const deviceId = tmp[tmp.length - 1];

    // Exit if no device ID was returned.
    if (deviceId == null) return null;

    // Get devicePublicModel from the server.
    const devicePublicModel = await util.getDevicePublicModel(deviceId, config);

    // Return the ID for the devicePrivateModel
    const privateId = devicePublicModel.privateData;

    if (privateData == null) return null;

    // TODO If the order is a renewal, then adjust the code path at this point.
    // Note, expiration date is auotmatically updated in the next promise.

    config.devicePrivateData = privateData;
    config.obNotice = thisNotice;

    // Mark the order as fulfilled.
    await util.fulfillOBOrder(config);

    if (thisNotice === undefined) return null;

    config.obNotice = thisNotice;

    // Mark notification as read.
    await util.markNotificationAsRead(config);

    if (devicePublicData === undefined) return null;

    // Update the expiration date.
    await util.updateExpiration(config, devicePublicData._id, 10);

    if (devicePublicData === undefined) return null;

    // Add the device to the Rented Devices list.
    await util.addRentedDevice(config, devicePublicData._id);

    if (devicePublicData === undefined) return null;

    // Remove the listing from the OB store.
    await util.removeOBListing(config, devicePublicData);

    console.log(`OB listing for ${devicePublicData._id} successfully removed.`);
  } catch (err) {
    if (err.statusCode >= 500) {
      console.error(
        `There was an issue with finding the listing on the OpenBazaar server. Skipping.`
      );
    } else {
      config.logr.error(`Error in listing-manager.js/fulfillNewOrders(): ${err}`);
      config.logr.error(`Error stringified: ${JSON.stringify(err, null, 2)}`);
    }
  }
}

/*
  This function checks for order notications from the OpenBazaar (OB) store.
  When a new order comes in, it marks the order 'Fulfilled' and sends the login
  information to the Renter.
*/
function checkNotifications() {
  //debugger;

  // Higher scoped variables.
  let devicePublicData, devicePrivateDat;
  let thisNotice; // Will not stay here. Just for testing.

  const now = new Date();
  logr.info(`Listing Manager checking for new orders at ${now}`);

  const config = {
    apiCredentials: apiCredentials,
  };

  // Get NEW notifications.
  util
    .getOBNotifications(config)

    // Process any unread notifications
    .then(notes => {
      // For now, assuming I have one order at a time.
      thisNotice = notes[0];

      // Exit if no notices were found.
      if (thisNotice === undefined) return null;

      // Exit if the notice is not for an order.
      if (thisNotice.notification.type !== "order") return null;

      // Get device ID from the listing
      const tmp = thisNotice.notification.slug.split("-");
      const deviceId = tmp[tmp.length - 1];

      return deviceId;
    })

    // Get devicePublicModel from the server.
    .then(deviceId => {
      if (deviceId == null) return null;
      //debugger;

      return util
        .getDevicePublicModel(deviceId)

        .then(publicData => {
          devicePublicData = publicData; // Save the device data to a higher scoped variable.
          return publicData.privateData; // Return the ID for the devicePrivateModel
        })
        .catch(err => {
          throw err;
        });
    })

    // Get the devicePrivateData from the server.
    .then(privateDataId => {
      if (privateDataId == null) return null;
      //debugger;

      return util
        .getDevicePrivateModel(privateDataId)

        .then(privateData => {
          devicePrivateData = privateData; // Save the device data to a higher scoped variable.
          return privateData;
        });
    })

    // Fulfill order with login information.
    .then(privateData => {
      if (privateData == null) return null;

      // TODO If the order is a renewal, then adjust the code path at this point.
      // Note, expiration date is auotmatically updated in the next promise.

      const config = {
        devicePrivateData: privateData,
        obNotice: thisNotice,
        apiCredentials: apiCredentials,
      };

      return util.fulfillOBOrder(config);
    })

    // Mark unread notifications as read.
    // POST /ob/marknotificationsasread
    .then(() => {
      if (thisNotice === undefined) return null;
      //debugger;

      const config = {
        apiCredentials: apiCredentials,
        obNotice: thisNotice,
      };

      return util.markNotificationAsRead(config);
    })

    // Update the expiration date.
    .then(() => {
      if (devicePublicData === undefined) return null;

      //debugger;
      return util.updateExpiration(devicePublicData._id, 10);
    })

    // Add deviceId to the rentedList model.
    .then(() => {
      if (devicePublicData === undefined) return null;

      //debugger;
      util.addRentedDevice(devicePublicData._id);
    })

    // Remove the listing from the OB store.
    .then(() => {
      if (devicePublicData === undefined) return null;
      //debugger;

      util
        .removeOBListing(devicePublicData)
        .then(val => {
          console.log(`OB listing for ${devicePublicData._id} successfully removed.`);
        })
        .catch(err => {
          console.error(`Could not remove OB listing for ${devicePublicData._id}`);
          if (err.statusCode >= 500) {
            console.error(
              `There was an issue with finding the listing on the OpenBazaar server. Skipping.`
            );
          } else {
            console.error(JSON.stringify(err, null, 2));
          }
        });
    })

    .catch(function(err) {
      debugger;
      console.error("Error communicating with local OpenBazaar Server!");

      if (err.cause) {
        if (err.cause.code === "ECONNREFUSED" || err.cause.code === "ECONNRESET")
          console.error("Connection to the server was refused. Will try again.");
        else console.error(JSON.stringify(err, null, 2));
      } else {
        console.error(JSON.stringify(err, null, 2));
      }
    });
}
// Call checkNotifications() every 2 minutees.
const notificationTimer = setInterval(function() {
  //checkNotifications();
  fulfillNewOrders();
}, CHECK_OB_NOTIFICATIONS_INTERVAL);
//checkNotifications(); // Call right away at startup.
fulfillNewOrders();

// Amount of time (mS) a device can go without checking in.
const MAX_DELAY = 60000 * 10; // 10 minutes.

// Check all rented devices to ensure their connection is active.
function checkRentedDevices() {
  //debugger;

  // Get a list of rented devices from the server.
  util
    .getRentedDevices()

    // Loop through each device.
    .then(async rentedDevices => {
      //debugger;

      for (let i = 0; i < rentedDevices.length; i++) {
        const thisDeviceId = rentedDevices[i];

        // Get the devicePublicModel for this device.
        const publicData = await util.getDevicePublicModel(thisDeviceId);

        const checkinTimeStamp = new Date(publicData.checkinTimeStamp);
        const now = new Date();
        const delay = now.getTime() - checkinTimeStamp.getTime();

        // If device has taken too long to check in.
        if (delay > MAX_DELAY) {
          //debugger;

          return (
            util
              // Set the device expiration to now.
              .updateExpiration(thisDeviceId, 0)

              // Remove the deviceId from the rentedDevices model on the server.
              .then(() => {
                return util.removeRentedDevice(thisDeviceId);
              })

              .then(() => {
                console.log(
                  `Device ${thisDeviceId} has been removed from the rented devices list due to inactivity.`
                );
              })
          );
        }
      }

      return true;
    })

    .catch(err => {
      debugger;
      console.error("Error running checkRentedDevices(): ");

      if (err.statusCode >= 500)
        console.error("Connection to the server was refused. Will try again.");
      else if (err.statusCode === 404) console.error("Server returned 404. Is the server running?");
      else console.error(JSON.stringify(err, null, 2));
    });
}
//checkRentedDevices(); // Call the function immediately.

// Call checkRentedDevices() every 2 minutees.
//const checkRentedDevicesTimer = setInterval(function() {
//  checkRentedDevices();
//}, CHECK_RENTED_DEVICES_INTERVAL);

// Check all listings in the OB market to ensure their connection is active.
function checkListedDevices() {
  //debugger;

  const config = {
    apiCredentials: apiCredentials,
  };

  return (
    util
      // Get all the listing on this OpenBazaar store.
      .getOBListings(config)

      // Loop through each device.
      .then(async listings => {
        //debugger;

        for (let i = 0; i < listings.length; i++) {
          // Get device ID from listing slug
          const thisSlug = listings[i].slug;
          const tmp = thisSlug.split("-");
          const thisDeviceId = tmp[tmp.length - 1];

          // Get the devicePublicModel for the current listing.
          const publicData = await util.getDevicePublicModel(thisDeviceId);

          const checkinTimeStamp = new Date(publicData.checkinTimeStamp);
          const now = new Date();
          const delay = now.getTime() - checkinTimeStamp.getTime();

          // If device has taken too long to check in.
          if (delay > MAX_DELAY) {
            debugger;

            console.log(`delay: ${delay}, MAX_DELAY: ${MAX_DELAY}`);

            return (
              util
                // Set the device expiration to now.
                .updateExpiration(thisDeviceId, 0)

                // Remove the listing from the OB store.
                .then(() => {
                  debugger;
                  return (
                    util
                      .removeOBListing(publicData)
                      //.then(val => {
                      //  console.log(`OB listing for ${thisDeviceId} successfully removed.`);
                      //})
                      .catch(err => {
                        console.error(`Could not remove OB listing for ${thisDeviceId}`);
                        if (err.statusCode >= 500) {
                          console.error(
                            `There was an issue with finding the listing on the OpenBazaar server. Skipping.`
                          );
                        } else {
                          console.error(JSON.stringify(err, null, 2));
                        }
                      })
                  );
                })

                .then(() => {
                  console.log(`OB listing for ${thisDeviceId} has been removed due to inactivity.`);
                })
            );
          }

          const expiration = new Date(publicData.expiration);

          const BUFFER = 60000 * 5; // Time to wait for client to voluntarily re-register.

          // If the device expiration date has been reached, remove the listing.
          if (expiration.getTime() + BUFFER < now.getTime()) {
            debugger;

            return util
              .removeOBListing(publicData)
              .then(val => {
                console.log(
                  `OB listing for ${thisDeviceId} has been removed due to expiration date reached.`
                );
              })
              .catch(err => {
                console.error(`Could not remove OB listing for ${thisDeviceId}`);
                if (err.statusCode >= 500) {
                  console.error(
                    `There was an issue with finding the listing on the OpenBazaar server. Skipping.`
                  );
                } else {
                  console.error(JSON.stringify(err, null, 2));
                }
              });
          }
        }

        return true;
      })

      // If device has taken too long to check in.
      // Set the device expiration to now.

      .catch(err => {
        debugger;
        console.error(`Error trying to check store listings: `);

        if (err.cause) {
          if (err.cause.code === "ECONNREFUSED" || err.cause.code === "ECONNRESET")
            console.error("Connection to the server was refused. Will try again.");
          else console.error(JSON.stringify(err, null, 2));
        } else if (err.statusCode === 502) {
          console.error("Connection to the server was refused. Will try again.");
        } else {
          if (err.message) console.error(`Error message: ${err.message}`);
          console.error(JSON.stringify(err, null, 2));
        }
      })
  );
}
//checkListedDevices(); // Call the function immediately.

// Call checkRentedDevices() every 2 minutees.
//const checkListedDevicesTimer = setInterval(function() {
//  checkListedDevices();
//}, CHECK_LISTED_DEVICES_INTERVAL);
