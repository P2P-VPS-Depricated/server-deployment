/*
  This library contains a list of functions used to interact with a local
  OpenBazaar store via its API. For reference documentation, see the API documents
  at http://api.openbazaar.org

  This library is for node.js programs using ECMA2017 async/await.
*/

"use strict";

// Dependencies
const rp = require("request-promise");

// Generate an auth key for the header. Required fall all OpenBazaar API calls.
function getOBAuth(clientID, clientSecret) {
  //debugger;

  //Encoding as per API Specification.
  const combinedCredential = `${clientID}:${clientSecret}`;
  //var base64Credential = window.btoa(combinedCredential);
  const base64Credential = Buffer.from(combinedCredential).toString("base64");
  const readyCredential = `Basic ${base64Credential}`;

  return readyCredential;
}

// This function returns a Promise that resolves to a list of notifications
// recieved by the OB store.
async function getNotifications(config) {
  try {
    const options = {
      method: "GET",
      uri: `${config.server}:${config.port}/ob/notifications`,
      json: true, // Automatically stringifies the body to JSON
      headers: {
        Authorization: config.apiCredentials,
      },
    };

    return rp(options);
  } catch (err) {
    config.logr.error(`Error in openbazaar.js/getNotifications(): ${err}`);
    config.logr.error(`Error stringified: ${JSON.stringify(err, null, 2)}`);
    throw err;
  }
}

// Mark an order as 'Fulfilled'.
async function fulfillOrder(config, body) {
  try {
    const options = {
      method: "POST",
      uri: `${config.server}:${config.port}/ob/orderfulfillment`,
      body: body,
      json: true, // Automatically stringifies the body to JSON
      headers: {
        Authorization: config.apiCredentials,
      },
    };

    return rp(options);
  } catch (err) {
    config.logr.error(`Error in openbazaar.js/fulfillOrder(): ${err}`);
    config.logr.error(`Error stringified: ${JSON.stringify(err, null, 2)}`);
    throw err;
  }
}

module.exports = {
  getOBAuth,
  getNotifications,
  fulfillOrder,
};
