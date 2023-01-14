# Spotify Reorder Playlist
Reorder your spotify playlist in ascending/descending order by date added.

## Motivation
I have a playlist with many songs and I wanted to reorder in ascending order by date added. This new order should be the same for everyone, not just locally. I couldn't find any way to do this in the spotify app so I decided to write a script to do it for me.

## Installation
### Prerequisites
- Own the playlist
- Have node.js and npm installed
  - You can install them from [here](https://nodejs.org/en/download/)
- Have your spotify credentials (Client ID and Client Secret)
  - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create a new app
  - Copy the Client ID and Client Secret
  - Go to `Edit Settings` and add `http://localhost:1234/callback` to the Redirect URIs
  - Save and you're done!

## Steps
1. Clone the repository: `git clone https://github.com/MaxPuig/spotify-reorder-playlist.git`
2. Install libraries: `npm install`
3. Modify `config.json` with your spotify `clientId`, `clientSecret`, `playlistId`, and `descending`
   > The `playlistId` looks like this `"0BxSFctZ12PYY7ysO9mrTc"` and can be found in the url of the playlist.
   
   > `"descending" : true` means that new songs will be at the top of the playlist. Can also be `false` for the reverse order.
4. Run the script `node index.js`
5. Access http://localhost:1234/authorize to authorize the app to access your spotify account and start the reordering process
   > When authorizing it for the first time, it might fail. Just reload the website and try again.
6. Wait for the script to finish and enjoy your reordered playlist!