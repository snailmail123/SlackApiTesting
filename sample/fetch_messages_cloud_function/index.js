const { WebClient } = require('@slack/web-api');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

/**
 * This script fetches all messages from all channels in a Slack workspace and writes them to a JSON file in Google Cloud Storage.
 * It uses the Slack Web API to:
 * 1. Fetch a list of all channels in the workspace.
 * 2. Iterate through each channel and fetch all messages from that channel.
 * 3. Handle pagination to ensure all messages are retrieved.
 * 4. Respect Slack API rate limits to avoid being rate-limited.
 * 5. Write the fetched messages to a JSON file in Google Cloud Storage.
 */

const token = process.env.SLACK_TOKEN;
const bucketName = 'ctrlpanel-ai';

const web = new WebClient(token);
const storage = new Storage();

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

    return messages;
  } catch (error) {
    console.error(`Error fetching messages from channel ${channelId}:`, error);
    return [];
  }
}

async function fetchAllMessagesFromMultipleChannels() {
  try {
    const channels = await fetchAllChannels();
    const allMessages = {};

    for (const { id, name } of channels) {
      console.log(`Fetching messages from channel: ${name} (${id})`);
      const channelMessages = await fetchAllMessagesFromChannel(id);
      allMessages[name] = channelMessages;
      console.log(`Fetched ${channelMessages.length} messages from channel: ${name}`);
    }

    // Save to file in Google Cloud Storage
    const filePath = path.join('/tmp', 'allMessages.json');
    fs.writeFileSync(filePath, JSON.stringify(allMessages, null, 2));

    await storage.bucket(bucketName).upload(filePath, {
      destination: 'allMessages.json',
    });
    console.log('Messages have been written to allMessages.json in GCS');

    return allMessages;
  } catch (error) {
    console.error('Error fetching messages from multiple channels:', error);
    return {};
  }
}

exports.fetchMessages = async (req, res) => {
  const allMessages = await fetchAllMessagesFromMultipleChannels();
  res.status(200).send(allMessages);
};
