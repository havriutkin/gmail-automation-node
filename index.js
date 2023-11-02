const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const notifier = require('node-notifier');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// List of senders to track
const senders = ['ovlodaet@gmail.com'];

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Gets amount of unread messages from tracked senders
 * 
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {List<Object} ([{from: , amount: }, ])
 */
async function getMessages(auth){
    const gmail = google.gmail({version: 'v1', auth});
    const result = []

    for (let sender of senders){
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `from:${sender} is:unread`,
        });

        result.push({
            from: sender,
            amount: response.data.messages.length
        });
    }
    return result;
}

function sendNotifications(messages){
    messages.forEach(({from, amount}) => {
        notifier.notify({
            title: `You recieved new message from ${from}`,
            message: `You have ${amount} unread questions from ${from}`,
            icon: path.join(__dirname, 'logo.png'),
            contentImage: path.join(__dirname, 'logo.png')
        })
    });
}

function daemon(){
    authorize()
    .then(getMessages)
        .then(sendNotifications)
    .catch(console.error);
}

daemon();
setInterval(daemon, 1000 * 60 * 30);

/**
 * TODO: 
 *  Fix problem with Icon in notifier, 
 *  Implement onClick function that redirects user to mailbox
 */