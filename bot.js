'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const apiai = require('apiai');
const app = express();
const apiaiApp = apiai(process.env.API_AI_CLIENT_ACCESS_TOKEN);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

app.get('/webhook', (req, res) => {
	if (req.query['hub.mode'] == 'subscribe' &&
		req.query['hub.verify_token'] == process.env.VERIFY_TOKEN) {
		console.log('Validating webhook');
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.log('Validation failed, make sure your validation tokens are the same');
		res.sendStatus(403);
	}
});

// Setup messenger profile for getting started and greeting text
app.get('/setup', (req, res) => {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token=' + process.env.PAGE_ACCESS_TOKEN,
		method: 'POST',
		json: {
			"get_started":{
			    "payload": 'GET_STARTED_PAYLOAD'
			  },
			  "greeting":[
			    {
			      "locale": 'default',
			      "text": 'Hi, I am VeriBot and I can help you identify fake news stories'
			    }
			  ]
		}
	}, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			console.log('Bot profile set');
			res.status(200).send('Bot Profile set');
		} else {
			console.error('Error: Bot profile setup failed', error);
			res.sendStatus(400);

		}
	});
});

//Handle all messages by first iterating over entries if batched
app.post('/webhook', (req, res) => {
	let data = req.body;
	if (data.object == 'page') {
		data.entry.forEach((entry) => {
			entry.messaging.forEach((event) => {
				let senderID = event.sender.id;
				if (event.message) {
					senderActions(senderID);
					receivedMessage(event);
				}
				else if (event.postback) {
					senderActions(senderID);
					receivedPostback(event);
				} else {
					console.log('Error: Webhook received invalid event', event);
				}
			});
		});
		res.sendStatus(200);
	}
});

// determine type of message received and send appropriate response
function receivedMessage(event) {
	let senderID = event.sender.id;
           let messageText = event.message.text;
           let messageAttachments = event.message.attachments;

           if (messageText) {
             sendGenericMessage(senderID, messageText);
           } else if (messageAttachments) {
             sendTextMessage(senderID, "Message with attachment received");
           }
}

// handle postback event
function receivedPostback(event) {
	let senderID = event.sender.id;
	let payload = event.postback.payload;
	let token = process.env.PAGE_ACCESS_TOKEN
	let profileUrl = `https://graph.facebook.com/v2.6/${senderID}?fields=first_name&access_token=${token}`
	console.log('Received postback event')

	// check payload received in postback event in order to send appropriate response
	if (payload == 'GET_STARTED_PAYLOAD') {
			request.get(profileUrl, (err, response, body) => {
				if (!err && response.statusCode == 200) {
					let json = JSON.parse(body);
					var text = '';
					// set personalised message with first name if available in received object
					if (json.hasOwnProperty('first_name')) {
						text = 'Hello ' + json.first_name + ', I am VeriBot and I can help you identify fake news stories. \n\nTo get my attention simply type "Is it true that" followed by the news headline or snippet like so, "Is it true that South Koreans mock Trump\'s armada \'bluff\'"';
					} else {
						text = 'Hello, I am VeriBot and I can help you identify fake news stories. \n\nTo get my attention simply type "Is it true that" followed by the news headline or snippet like so, "Is it true that South Koreans mock Trump\'s armada \'bluff\'"';
					}

					sendTextMessage(senderID, text);
					
				} else {
					console.log('Error: Failed to get user profile')
				}
			});
	}
}

function sendGenericMessage(recipientID, messageText) {
	let apiai = apiaiApp.textRequest(messageText, {
	    sessionId: process.env.SESSION_ID // use any arbitrary id for session
	  });

	apiai.on('response', (response) => {
	    // Got a response from api.ai. Let's POST to Facebook Messenger
	    let aiText = response.result.fulfillment.speech;

	    // send structured message to Facebook Messenger, api.ai intent resolved
	    if (aiText.includes('*')) {
	    	let [prediction, probabilty, claim] = aiText.split('*');
		let imgUrl = '';
		let tipsUrl = 'https://web.facebook.com/help/188118808357379'
		let text = `The news story ${claim} is ${prediction}`;

		if (prediction == 'fake') {
			imgUrl = 'http://i.imgur.com/4wHZox3.png';
		} else if (prediction == 'real') {
			imgUrl = 'http://i.imgur.com/v6XYMku.png';
		}

		let messageData = {
		    recipient: {
		      id: recipientID
		    },
		    message: {
		    	"attachment": {
		    		"type": "template",
		    		"payload": {
		    			"template_type":"generic",
		    			"elements": [
		    			    {
		    			    	"title": `I am ${probabilty}% sure about that`,
		    			    	"image_url": imgUrl,
		    			    }
		    			]
		    		}
		    	}
		    }
		};

		// generic message sent first and button message sent in the callback
		request({
			uri: 'https://graph.facebook.com/v2.6/me/messages',
			qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
			method: 'POST',
			json: messageData
		}, (error, response, body) => {
			if (!error && response.statusCode == 200) {
				console.log('Generic template message sent sucessfully to the recipient');
				sendButtonMessage(recipientID, text, tipsUrl);
			} else {
				console.error('Error: Message sending failed', error);
			}
		});
	    } else {
	    	sendTextMessage(recipientID, aiText);
	    }
	});

	apiai.on('error', (error) => {
	    console.log(error);
	});

	apiai.end();	 
}

function sendTextMessage(recipientID, messageText) {
	let messageData = {
	    recipient: {
	       id: recipientID
	    },
	    message: {
	       text: messageText
	    }
	};

	callSendAPI(messageData);
}

function sendButtonMessage(recipientID, messageText, tipsUrl) {
	let messageData = {
		recipient: {
		  id: recipientID
		},
		message: {
			"attachment": {
				"type": "template",
				"payload": {
					"template_type":"button",
					"text": messageText,
					    	"buttons": [
					    	    {
					    	    	"type": 'web_url',
					    	    	"url": tipsUrl,
					    	    	"title": 'Fake News Tips'
					    	    }
					    	]
				}
			}
		}
	}

	callSendAPI(messageData);
}

// Webhook for API.AI intents matched from a user's message
app.post('/ai', (req, res) => {
	console.log('received a POST request from API.AI, intent matched');
	if (req.body.result.action == 'predict') {
		let claim = req.body.result.parameters['any'];
		let restUrl = `http://ofemeteng.pythonanywhere.com/predict/${claim}`;

		request.get(restUrl, (err, response, body) => {
			if (!err && response.statusCode == 200) {
				let json = JSON.parse(body);
				let prediction = json.prediction.toLowerCase();
				let probabilty = json.probabilty;
				let msg = `${prediction}*${probabilty}*${claim}`;
				return res.json({
					speech: msg,
					displayText: msg,
					source: 'Fake News ML API'
				});
			} else {
				let errorMessage = 'I couldn\'t verify that news story';
				return res.status(400).json({
					status: {
						code: 400,
						errorType: errorMessage
					}
				});
			}
		});
	}
});

//Send response to user
function callSendAPI(messageData) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
		method: 'POST',
		json: messageData
	}, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			console.log('Message sent sucessfully to the recipient');
		} else {
			console.error('Error: Message sending failed', error);
		}
	});
}

// Set typing indicator
function senderActions(senderID) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages?access_token=' + process.env.PAGE_ACCESS_TOKEN,
		method: 'POST',
		json: {
		  "recipient":{
		  	"id": senderID
		  },
		  "sender_action":'typing_on'
		}
	}, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			console.log('Sender actions sent');
		} else {
			console.error('Error: Sender actions failed', error);
		}
	});
	return;
}

const server = app.listen(process.env.PORT || 3100, () => {
	console.log(`Server listening on port: ${server.address().port}`);
});