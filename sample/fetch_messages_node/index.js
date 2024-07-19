require('dotenv').config({ path: '../.env' });
const { WebClient } = require('@slack/web-api');
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');

const token = process.env.SLACK_TOKEN;
const projectId = process.env.PROJECT_ID;
const keyFilename = path.join(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const companyName = 'ctrlpanel';

if (!token) {
  throw new Error('SLACK_TOKEN environment variable is not set.');
}
if (!projectId) {
  throw new Error('PROJECT_ID environment variable is not set.');
}
if (!keyFilename) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
}

const web = new WebClient(token);

const firestore = new Firestore({
  projectId: projectId,
  keyFilename: keyFilename
});

async function fetchAllChannels() {
  try {
    let channels = [];
    let hasMore = true;
    let cursor;

    while (hasMore) {
      const response = await web.conversations.list({
        cursor: cursor,
        limit: 1000
      });

      channels = channels.concat(response.channels);

      cursor = response.response_metadata.next_cursor;
      hasMore = !!cursor;
    }

    return channels.map(channel => ({
      id: channel.id,
      name: channel.name
    }));
  } catch (error) {
    console.error('Error fetching channel IDs:', error);
    return [];
  }
}

async function fetchAllMessagesFromChannel(channelId) {
  try {
    let messages = [];
    let hasMore = true;
    let cursor;

    while (hasMore) {
      const response = await web.conversations.history({
        channel: channelId,
        cursor: cursor,
        limit: 1000
      });

      messages = messages.concat(response.messages);

      cursor = response.response_metadata.next_cursor;
      hasMore = !!cursor;
    }

    return messages.map(message => ({
      user: message.user || null,
      text: message.text || '',
      ts: message.ts || null,
      type: message.type || ''
    }));
  } catch (error) {
    console.error(`Error fetching messages from channel ${channelId}:`, error);
    return [];
  }
}

async function fetchAllMessagesFromMultipleChannels() {
  try {
    const channels = await fetchAllChannels();
    for (const { id, name } of channels) {
      console.log(`Channel: ${name} (${id})`);
      const channelMessages = await fetchAllMessagesFromChannel(id);
      
      console.log(`Messages from channel: ${name} (${id}):`);
      channelMessages.forEach(message => {
        console.log(message);
      });

      const batch = firestore.batch();
      const channelDocRef = firestore.collection(companyName).doc(name);
      channelMessages.forEach(message => {
        const messageRef = channelDocRef.collection('messages').doc();
        batch.set(messageRef, message);
      });
      await batch.commit();
      console.log(`Stored ${channelMessages.length} messages from channel: ${name} in Firestore`);
    }

    console.log('Messages have been fetched from all channels');
  } catch (error) {
    console.error('Error fetching messages from multiple channels:', error);
  }
}

fetchAllMessagesFromMultipleChannels().then(() => {
  console.log('Finished fetching messages');
}).catch(error => {
  console.error('Error during execution:', error);
});
