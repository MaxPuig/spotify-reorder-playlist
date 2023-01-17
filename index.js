const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config.json');
const EventSource = require('eventsource');
const progressEvent = new EventSource('/progress');

const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
});

const app = express();

app.get("/", (req, res) => {
    let html = `<html><head><title>Authorize Spotify</title><style>body {display: flex; flex-direction: column; align-items: center; 
        justify-content: center; background-color: black;} button {margin: 10px; } h1 {color: white;}</style></head><body>
        <h1>Authorize Spotify</h1><button onclick="window.location.href='/authorize'">Authorize</button>
        <p style="text-align: center; color: white">If authorization fails, reload the Spotify website and try again.</p>
        </body></html>`;
    res.send(html);
});

app.get("/authorize", (req, res) => {
    const scopes = ["playlist-modify-public", "playlist-modify-private"];
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get("/playlist", async (req, res) => {
    try {
        // Get all playlists of the user
        const playlists = await spotifyApi.getUserPlaylists();
        let playlistList = playlists.body.items;
        let html = `<html><head><title>Your Playlists</title><style>body {display: flex; flex-direction: column; align-items: center; 
            justify-content: center; background-color: black;} h1 {text-align: center; color: white} .playlist-buttons {display: flex; 
            flex-direction: column;} button {margin: 10px;}</style></head><body><h1>Your Playlists</h1><div class='playlist-buttons'>`;
        // Loop through each playlist and create a button for it
        playlistList.forEach(playlist => {
            html += `<button onclick="return confirm('Are you sure you want to reorder the playlist: ${playlist.name}?');">
            <a href="/reorder?playlistId=${playlist.id}">${playlist.name}</a></button>`;
        });
        html += "</div></body></html>";
        res.send(html);
    } catch (err) {
        console.log("Something went wrong", err);
        res.status(500).send("An error occurred while trying to retrieve the playlists");
    }
});

app.get("/callback", (req, res) => {
    const { code } = req.query;
    spotifyApi.authorizationCodeGrant(code)
        .then(data => {
            const { access_token, refresh_token } = data.body;
            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);
            res.redirect("/playlist");
        })
        .catch(err => {
            console.log("Something went wrong!", err);
            res.redirect("/");
        });
});

app.get("/reorder", async (req, res) => {
    try {
        // Get the tracks of the playlist
        const playlistId = req.query.playlistId;
        const tracks = await spotifyApi.getPlaylistTracks(playlistId, { offset: 0, limit: 100 });
        if (tracks.body.total > 100) {
            for (let i = 0; i < Math.floor(tracks.body.total / 100); i++) {
                const nextTracks = await spotifyApi.getPlaylistTracks(playlistId, { offset: (i + 1) * 100, limit: 100 });
                tracks.body.items.push(...nextTracks.body.items);
            }
        }
        let trackList = tracks.body.items;
        let songs = [];
        let i = 0;
        for (let track of trackList) {
            track.originalPosition = i;
            i++;
            songs.push(track);
        }
        // Order the tracks by the date they were added, newest to oldest and create a variable for the new position to each track
        songs.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
        if (config.descending) songs.reverse();
        let j = 0;
        for (let song of songs) {
            song.newPosition = j;
            j++;
        }
        // Sort the songs by their original position
        songs.sort((a, b) => new Date(a.originalPosition) - new Date(b.originalPosition));
        // Reorder the playlist
        res.redirect("/progress");
        await sleep(1000);
        for (let to = 0; to < songs.length; to++) {
            let from;
            for (let j = 0; j < songs.length; j++) {
                if (to == songs[j].newPosition) from = songs[j].originalPosition;
            }
            if (to != from) {
                await sleep(2000); // prevent being ratelimited
                await spotifyApi.reorderTracksInPlaylist(playlistId, from, to);
                songs = arraymove(songs, from, to);
                for (let k = to + 1; k < from + 1; k++) {
                    songs[k].originalPosition++;
                }
                // Emit an event containing the current progress
                progressEvent.emit('progress', `Reordered ${to + 1} out of ${tracks.body.total} tracks - Moved from ${from + 1} to ${to + 1}`);
                console.log(`Reordered ${i + 1} out of ${tracks.body.total} tracks - Moved from ${from + 1} to ${to + 1}`);
            } else {
                progressEvent.emit('progress', `Skipped ${to + 1} - Already in the correct position`);
                console.log(`Skipped: ${to} - ${from}`);
            }
        }
        progressEvent.emit('finish');
        console.log("Playlist reordered successfully");
    } catch (err) {
        progressEvent.emit('error_reorder', err);
        console.log("Something went wrong", err);
    }
});

let progress;
app.get("/progress", (req, res) => {
    progress = res;
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write("Starting to order the playlist...\n\n");
});

progressEvent.on("progress", (data) => {
    progress.write(`${data}\n`);
});

progressEvent.on("error_reorder", (err) => {
    progress.write(`Something went wrong: ${err.toString()}\n\n`);
    progress.end();
});

progressEvent.on("finish", () => {
    progress.write("Playlist reordered successfully!\n\n");
    progress.end();
});

app.listen(1234, () => {
    console.log("Server running at http://localhost:1234");
});

function arraymove(arr, fromIndex, toIndex) {
    var element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
    return arr;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }