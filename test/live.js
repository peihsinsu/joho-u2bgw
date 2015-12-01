var googleapis = require('googleapis');
//var request = require('request');
var moment = require('moment');
var readline = require('readline');
var ffmpeg = require('fluent-ffmpeg');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var videoId = '';
var streamId = '';
var streamUrl = '';

var CLIENT_ID = '161639684388-6c8utml7h4f05qv02m90721butpktt4l.apps.googleusercontent.com';

var CLIENT_SECRET = 'KLzPuIuqbe1za7ueQMr_c1hj';
var REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
var getAccessToken = function(auth,next){
	url = auth.generateAuthUrl({
		access_tupe: 'offline',
		scope: 'https://www.googleapis.com/auth/youtube'
	});
	console.log('vist the url:'+url);
	rl.question("ENTER THE CODE? ", function(answer) {
	  // TODO: Log the answer in a database
	  console.log("Thank you for your valuable feedback:", answer);
	  auth.getToken(answer,function(err,tokens){
	  	if(!err){
	  		auth.setCredentials(tokens);
	  		next();
	  	}else{
	  		console.log('wrong oauth:',err);
	  	}
	  });
	  //rl.close();
	});
}	

auth = new googleapis.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

getAccessToken(auth,function(){
	console.log('success oauth ...');
});




