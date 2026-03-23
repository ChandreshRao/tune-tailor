# 🎙️ Alexa Private Skill Setup Guide

This guide explains how to set up a private Alexa Custom Skill to control your TuneTailor music server.

## 🛠️ Prerequisites

1.  **Public URL**: Your TuneTailor server must be accessible over the internet (HTTPS).

    ### Option A: zrok (Recommended for Persistent URL)
    **zrok** is an open-source alternative that allows you to reserve a static subdomain for free.

    1.  **Install zrok**: Follow the [installation guide](https://docs.zrok.io/docs/getting-started/).
    2.  **Invite & Enable**:
        ```bash
        zrok invite # Follow the email link to set a password
        zrok enable <token-from-web-ui>
        ```
    3.  **Reserve a Name**: (Only needs to be done once)
        ```bash
        zrok reserve public localhost:3000 --unique-name tunetailor123
        ```
    4.  **Start Sharing**:
        ```bash
        zrok share reserved tunetailor123
        ```
    Use the `https://tunetailor123.share.zrok.io` URL.

    5.  **Release a Name**: (If you no longer need the reserved name)
        ```bash
        zrok release tunetailor123
        ```


    ### Option B: Tunneling Alternatives
    - **ngrok**: `ngrok http 3000` (Free URLs change every time you restart).
    - **Cloudflare (cloudflared)**: `cloudflared tunnel --url http://localhost:3000` (Requires a Cloudflare account).

    > [!TIP]
    > Using **zrok** with a reserved name ensures your Alexa Skill doesn't break when you restart your local server.


## 📝 Step 1: Create the Skill

1.  Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
2.  Click **Create Skill**.
3.  **Skill Name**: Music Assistant (or your choice).
4.  **Language**: Match your Alexa device (e.g., English US).
5.  **Choose a model**: Custom.
6.  **Choose a method to host**: Alexa-hosted (Node.js).
7.  Click **Create Skill**. Use the "Hello World" template if prompted.

## 🗣️ Step 2: Interaction Model

1.  In the left sidebar, go to **Interaction Model > JSON Editor**.
2.  Replace the existing JSON with the contents of `alexa_skill/interactionModel.json` from this repository.
3.  Click **Save Model** and then **Build Model**.

## 💻 Step 3: Lambda Code

1.  Go to the **Code** tab at the top.
2.  Replace `index.js` with the contents of `alexa_skill/Skill Code/lambda/index.js` from this repo.

> [!IMPORTANT]
> You **must** update the `API_URL` constant at the top of `index.js` once your public URL (zrok, ngrok, or cloudflare) is generated:
> ```javascript
> // index.js
> // Example for zrok:
> const API_URL = "https://tunetailor-yourname.share.zrok.io/play";
> ```

4.  Update `package.json` with the following dependencies:
```json
{
  "name": "hello-world",
  "version": "1.2.0",
  "description": "alexa utility for quickly building skills",
  "main": "index.js",
  "author": "Amazon Alexa",
  "license": "Apache License",
  "dependencies": {
    "ask-sdk-core": "^2.7.0",
    "ask-sdk-model": "^1.19.0",
    "aws-sdk": "^2.326.0",
    "axios": "^0.27.2"
  }
}
```
5.  Click **Save** and then **Deploy**.

## ⚙️ Step 4: Enable AudioPlayer (Required)

1.  Go to the **Build** tab.
2.  Click **Interfaces** in the left sidebar.
3.  Toggle **Audio Player** to ON.
4.  Click **Save Interfaces** and then **Build Model** again.

## 🧪 Step 5: Testing

1.  Go to the **Test** tab.
2.  Change the "Test is disabled for this skill" dropdown to **Development**.
3.  Type or say: *"ask music assistant to play bohemian rhapsody"*
4.  Alexa should communicate with your ngrok URL, get the intent from TuneTailor, and start playing the audio.