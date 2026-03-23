# 🎵 TuneTailor

TuneTailor is a sophisticated local music assistant designed to bridge the gap between your music collection and AI-driven intent extraction. It allows you to search, manage, and play your local music library while mapping natural language queries to specific songs via the Gemini LLM.

## 🚀 Features

- **Dynamic Dashboard**: A modern, glassmorphic UI for managing your music and intent mappings.
- **AI-Powered Intent Extraction**: Uses Google's Gemini models to understand natural language requests (e.g., "play mandahasame").
- **Song Management**: 
  - Integrated multi-file upload support.
  - Automatic metadata extraction (Title, Artist, Album) using `music-metadata`.
  - CRUD operations for editing song details and deleting files.
- **Intent Mapping**:
  - Map specific queries to songs manually or automatically via AI.
  - Search, filter, and paginate through your intent library.
- **Application Settings**: 
  - Configure `SONGS_PATH`, `GEMINI_API_KEY`, and `MODELS` directly through the UI.
  - **Security**: Sensitive keys like `GEMINI_API_KEY` are masked by default with a visibility toggle.
- **Live Streaming**: Stream your local audio files directly to the browser.

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js (ESM)
- **Database**: SQLite (via `better-sqlite3`)
- **AI**: Google Gemini API (Axios)
- **Metadata**: `music-metadata`
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Styling**: Glassmorphism, CSS Variables, Responsive Design

## 🔑 Obtaining a Gemini API Key

To use the AI intent extraction features, you'll need a free API key from Google AI Studio:

1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Sign in with your Google account.
3.  Click on **Get API key** in the left sidebar.
4.  Click **Create API key in new project**.
5.  Copy your key and add it to your `.env` file or enter it in the **Application Settings** dashboard.

## 🎙️ Integrations

### Alexa Custom Skill
TuneTailor can be controlled via voice using a private Alexa skill. This allows you to say commands like *"Alexa, ask music assistant to play Bohemian Rhapsody"* to your Echo devices.

- **Setup Guide**: See the [Alexa Skill Setup Guide](file:///d:/chandreshRaoRepos/tune-tailor/alexa_skill/README.md) for detailed instructions.

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd tune-tailor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root based on the provided template:
   ```env
   GEMINI_API_KEY=your_api_key_here
   SONGS_PATH=./songs
   BASE_URL=http://localhost:3000
   ```

4. **Initialize Metadata**:
   Run the scanner to index your initial songs folder:
   ```bash
   node src/utils/scanner.js
   ```

## 🎮 Usage

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Access the dashboard**:
   Open your browser and navigate to `http://localhost:3000`.

3. **Manage Songs**:
   - Use the **+ Add Songs** button to upload multiple files.
   - Edit metadata directly in the table.
   - Click the **Play** icon to preview tracks.

4. **Map Intents**:
   - Add new mappings or edit existing ones.
   - Test queries in the search bar to see how they resolve.

## ⚙️ Configuration

The application settings are stored in a dedicated `settings` table in the SQLite database and can be managed via the **Application Settings** section at the bottom of the dashboard. Changes to the `SONGS_PATH` are applied dynamically to the scanner and streaming service.

## 📜 License

This project is licensed under the MIT License.
