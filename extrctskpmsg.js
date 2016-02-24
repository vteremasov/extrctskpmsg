'use strict';

let sqlite3 = require('sqlite3').verbose()
  , squel = require('squel')
  , fs = require('fs')
  , dbPath = '/home/' + (process.argv[2] || 'vit') +'/.Skype/' + (process.argv[3] || 'teremasov_v') + '/main.db'
  , pattern = new RegExp(process.argv[5] || 'online|logged off|Logged off|I am on|logging off|Logging off')
  , topic = process.argv[4] || "ClickHereDev"
  ;


function getSqlForTopic(topic) {
  return squel.select()
    .from('Chats')
    .field('friendlyname', 'name')
    .field('conv_dbid', 'id')
    .where('topic = "' + topic + '"')
    .toString();
}

function getSqlForMsgsForLastDay(rows) {
  return squel.select().from('Messages')
    .field('Messages.timestamp', 'timestamp')
    .field('Messages.id', 'id')
    .field('Messages.author', 'author')
    .field('Messages.body_xml', 'body')
    .join('Chats', '', squel.expr().and('Messages.convo_id = Chats.conv_dbid'))
    .where('Messages.convo_id = ' + rows[0].id)
    .where('Messages.timestamp >= ' + Math.ceil((new Date().getTime() - 1000 * 3600 * 24) / 1000))
    .limit(Math.ceil(new Date().getTime() / 1000))
    .toString();
}

function parseMessages(rows) {
  return rows.reduce((acc, message) => {
    if (!pattern.test(message.body)) return acc;
    message.date = new Date(message.timestamp * 1000).toString();
    return acc.concat([message])
  }, []);
}
function getMessages(err, rows) {
  if (err) throw err;
  let res = parseMessages(rows);
  console.log(res);
}

function verifyChat(err, rows) {
  if (err) throw err;
  if (!rows.length) throw new Error('Chat does not exists...');
  db.all(getSqlForMsgsForLastDay(rows), getMessages)
}

let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
  if (err) throw new Error(err);
  console.log('db connection opened...');
  db.all(getSqlForTopic(topic), verifyChat)
});
