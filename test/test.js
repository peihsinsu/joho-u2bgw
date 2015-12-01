var api = require('./../api/famiApi');
var request = require('request');
var secret = require('../config/client_secret.json').installed;
var googleapis = require('googleapis');
var rl = require('readline');
var testAPICfg = {
  "userName":"sunnyhu",
  "userToken":{
    "access_token":"ya29.FwJb7fnGJiPtO1m3ny7_2yAvPRmn97gthV9gnskBrsfKrmoaLO95nMjQnR4SVaehYocr",
    "token_type":"Bearer",
    refresh_token: '1/emzknGU5W_ZmE0Yzwo0DMLKve6cSrQ0sc92yzNRf7qU',
    expiry_date: 1445793271091
  },
  "duid":"GACWPNS291O6U46L0SC4",
  "rtspSource":"rtsp://104.155.214.170/GACWPNS291O6U46L0SC4"
};
/*console.log('xxx',config);
request.post('http://localhost:3001/processTest/end',
    {form:{rtspUrl:'rtsp://104.155.214.170/', surl:'rtmp://a.live.youtube.com',uName:'sunnyhu',duid:'GACWPNS291O6U46L0SC4' }},
    function(e,r,d){
      if(e) console.log('Some error happen',e);
      else console.log(d,'Success');

});
getAuth(config,testAPICfg.userToken,function(err,auth){
  console.log(err , '----->',auth);
  var youtube = googleapis.youtube('v3');
  var listArg = {
    part: 'id,snippet,contentDetails,status',
    mine : true,
    maxResults : 50 ,
    auth:auth
  }

  youtube.liveBroadcasts.list( listArg, function(err, broadcasts){
    console.log('list broads=====>',broadcasts);
  });
});*/
getAuth = function(secretStore,tokenStore,next){
  //change it to get with json file
  var auth = new googleapis.auth.OAuth2(
      secretStore.client_id,
      secretStore.client_secret,
      secretStore.redirect_uri);
  var youtube = googleapis.youtube('v3');
  /* first time get token using - getAccessToken
   console.log('auth back :',getAccessToken(auth,function(){
   console.log('after get token next ...');
   }));*/
  auth.setCredentials(tokenStore);
  console.log('auth look like:',auth);
  console.log('auth -----------------------');
  next(null,auth);
}

api.u2beLive(testAPICfg,function(err,msg){
  console.log('api call ------------------',err,msg);
});

/*api.getLiveInfo(testAPICfg,function(err,msg) {
  if (err) console.log(err);
  else console.log(msg);
});*/


getAccessToken = function (auth, next) {
  var url;
  url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/youtube'
  });
  console.log('Vist the url: ' + url);
  return rl.question('Enter the Code:', function (code) {
    return auth.getToken(code, function (err, tokens) {
      console.log(tokens);
      auth.setCredentials(tokens);
      return next();
    });
  });
};
