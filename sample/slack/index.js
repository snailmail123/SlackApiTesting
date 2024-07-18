const { WebClient } = require('@slack/web-api');
const fs = require('fs');
require('dotenv').config()

const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

/**
 * This script fetches all the messages from all channels in a Slack workspace (excluding dm's) and writes them to a JSON file.
 * The user token scopes used: channels:history, channels:read
 * It uses the Slack Web API to:
 * 1. Fetch a list of all channels in the workspace.
 * 2. Iterate through each channel and fetch all messages from that channel.
 * 3. Handle pagination to ensure all messages are retrieved.
 * 4. Respect Slack API rate limits to avoid being rate-limited.
 * 5. Write the fetched messages to a JSON file named 'allMessages.json'.
 */

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

    // Save to file
    fs.writeFileSync('allMessages.json', JSON.stringify(allMessages, null, 2));
    console.log('Messages have been written to allMessages.json');

    return allMessages;
  } catch (error) {
    console.error('Error fetching messages from multiple channels:', error);
    return {};
  }
}

fetchAllMessagesFromMultipleChannels()
  .then(allMessages => {
    if (Object.keys(allMessages).length > 0) {
      console.log('Fetched messages from all channels.');
    } else {
      console.log('No messages retrieved.');
    }
  })
  .catch(error => {
    console.error('Error in fetchAllMessagesFromMultipleChannels:', error);
  });
