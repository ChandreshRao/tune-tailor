const Alexa = require("ask-sdk-core");
const axios = require("axios");

// 🔥 Replace with your current ngrok URL
const API_URL = "<ngrok-url>/play";

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak("Welcome to your music assistant. What would you like to play?")
            .reprompt("Tell me a song name, like play Bohemian Rhapsody.")
            .getResponse();
    }
};

const PlayMusicHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === "PlayMusicIntent";
    },
    async handle(handlerInput) {
        let query = null;

        // Safely extract the slot value
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        if (slots && slots.query && slots.query.value) {
            query = slots.query.value;
        }

        try {
            // Call your external API
            const response = await axios.post(API_URL, { query }, { timeout: 5000 });
            const data = response.data;

            // 🎧 Play audio logic
            if (data.type === "play") {
                const audioUrl = data.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

                return handlerInput.responseBuilder
                    .speak(`Playing ${query || "your selection"}`)
                    .addAudioPlayerPlayDirective(
                        "REPLACE_ALL",
                        audioUrl,
                        "music-token-123",
                        0,
                        null
                    )
                    .withShouldEndSession(true) // Required for AudioPlayer to take over
                    .getResponse();
            }

            // ❓ Clarification from your API
            if (data.type === "clarification") {
                return handlerInput.responseBuilder
                    .speak(data.message || "Could you please be more specific?")
                    .reprompt("What song was that again?")
                    .getResponse();
            }

            // Fallback for unexpected data types
            return handlerInput.responseBuilder
                .speak("I found a result, but I'm having trouble playing it right now.")
                .getResponse();

        } catch (err) {
            console.error("API Error:", err.message);

            return handlerInput.responseBuilder
                .speak("I'm sorry, I'm having trouble reaching the music server. Please check if your system is online.")
                .getResponse();
        }
    }
};

// Essential for AudioPlayer skills to prevent "Suitable Handler Not Found" errors
const AudioPlayerEventHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope).startsWith('AudioPlayer.') ||
            Alexa.getRequestType(handlerInput.requestEnvelope).startsWith('PlaybackController.');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak("Sorry, I had trouble doing what you asked. Please try again.")
            .getResponse();
    },
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        PlayMusicHandler,
        AudioPlayerEventHandler, // MUST BE INCLUDED
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();