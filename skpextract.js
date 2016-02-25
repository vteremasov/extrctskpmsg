#!/usr/bin/env node
'use strict';

let sqlite3 = require('sqlite3').verbose()
  , squel = require('squel')
  , async = require('async')
  , fs = require('fs')
  , readline = require('readline')
  , merge = require('xtend')
  , rl = readline.createInterface(process.stdin, process.stdout)
  ;

async.waterfall([
  function(callback){
    var usersList = fs.readdirSync('/home/');
    var getUserQuestion = usersList.reduce((acc, user, index) => {
      return acc.concat("\n").concat(user).concat(": ").concat(index).concat("\n")
    }, "Inter number to choose you system user ");
    rl.question(getUserQuestion, (userIndex) => {
      if(isNaN(parseInt(userIndex)) || parseInt(userIndex) >= userIndex.length) return callback("Incorrect Input..." + userIndex);
      callback(null, {user: usersList[parseInt(userIndex)]});
    });
  },
  function(opts, callback){
    var skypeUsersList = fs.readdirSync('/home/'+opts.user+"/.Skype").filter(element => {return ["DataRv", "shared_dynco", "shared_httpfe", "shared.lck", "shared.xml"].indexOf(element) < 0});
    rl.question(skypeUsersList.reduce((acc, skypeUser, index) => {
      return acc.concat("\n").concat(skypeUser).concat(": ").concat(index).concat("\n")
    }, "Inter number to choose a skype user "), (skypeUser) => {
      if(isNaN(parseInt(skypeUser)) || parseInt(skypeUser) >= skypeUsersList.length) return callback("Incorrect Input..." + userIndex);
      opts.skypeUser = skypeUsersList[parseInt(skypeUser)];
      callback(null, opts);
    })
  },
  function(opts, callback){
    var path = '/home/'+opts.user+'/.Skype/'+opts.skypeUser + '/main.db';
    opts.db = new sqlite3.Database(path, sqlite3.OPEN_READONLY, err => {
      console.log(path, err);
      if(!err) console.log("Db connection opened...");
      return callback(err, opts);
    })
  },
  function(opts, callback){
    rl.question("If your chat has topic [Y/n]?\n", (answer) => {
      hasTopic(answer) ? opts.dbColumn = 'topic': opts.dbColumn = 'friendlyname';
      callback(null, opts);
    })
  },
  function(opts, callback){
    rl.question('Inter chat '+(opts.dbColumn == 'topic'? 'topic': "friend name or names(comma separated)")+' (In quotes "TopicName")\n', (chatName) => {
      if(!chatName) return callback("No chat name");
      opts.chatName = chatName;
      callback(null, opts);
    })
  },
  function(opts, callback){
    opts.db.all(getSqlForTopic(opts.chatName, opts.dbColumn), (err, rows) => {
      if(err || !rows.length) return callback(err || "Chat Not Found...");
      console.log("Chat Found...")
      opts.chatId = rows[0].id;
      callback(null, opts);
    })
  },
  function(opts, callback){
    rl.question("Inter time range mm-dd-yyyy>>mm-dd-yyyy (Press Enter for default last 24 hours)\n", (dateRange)=>{
      dateRange = parseDateRange(dateRange);
      if(dateRange.since > dateRange.until) return callback("Dates are wrong");
      return callback(null, merge(opts, dateRange));
    })
  },
  function(opts, callback){
    rl.question("Inter pattern in javascript regular expression format (Press Enter for default all *)\n", (pattern) => {
      if(!pattern) pattern = ".*";
      opts.pattern = new RegExp(pattern);
      return callback(null, opts);
    })
  },
  function(opts, callback){
    opts.db.all(getSqlForMsgs(opts), function(err, rows){
      return callback(err, parseMessages(opts.pattern, rows))
    })
  }
], function(error, result){
  if(error) throw new Error(error);
  console.log(result);
  rl.close()
});


function hasTopic(hasTopic) {
  return !hasTopic || new RegExp('Y|y|Yes|yes').test(hasTopic);
}

function getSqlForTopic(chatName, column) {
  return squel.select()
    .from('Chats')
    .field('friendlyname', 'name')
    .field('conv_dbid', 'id')
    .where((column || 'topic') + ' = ' + chatName)
    .toString();
}


function parseDateRange(dateRange) {
  dateRange = dateRange.split('>>');
  let yesterday = new Date().getTime() - 1000 * 3600 * 24;
  let today = new Date().getTime();
  // divide by 1000 because skype store timestamp in seconds
  return {since: Math.ceil(new Date(dateRange[0] || yesterday)/1000), until: Math.ceil(new Date(dateRange[1] || today)/1000)};
}

function getSqlForMsgs(opts) {
  return squel.select().from('Messages')
    .field('Messages.timestamp', 'timestamp')
    .field('Messages.id', 'id')
    .field('Messages.author', 'author')
    .field('Messages.body_xml', 'body')
    .join('Chats', '', squel.expr().and('Messages.convo_id = Chats.conv_dbid'))
    .where('Messages.convo_id = ' + opts.chatId)
    .where('Messages.timestamp >= ' + opts.since)
    .limit(opts.until)
    .toString();
}

function parseMessages(pattern ,rows) {
  return rows.reduce((acc, message) => {
    if (!pattern.test(message.body)) return acc;
    message.date = new Date(message.timestamp * 1000).toString();
    return acc.concat([message])
  }, []);
}