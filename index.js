const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config.json');


const playlistId = config.playlistId;
const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
});


const app = express();

app.get("/authorize", (req, res) => {
    const scopes = ["playlist-modify-public", "playlist-modify-private"];
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get("/callback", (req, res) => {
    const { code } = req.query;
    spotifyApi.authorizationCodeGrant(code)
        .then(data => {
            const { access_token, refresh_token } = data.body;
            spotifyApi.setAccessToken(access_token);
            spotifyApi.setRefreshToken(refresh_token);
            res.redirect("/reorder");
        })
        .catch(err => {
            console.log("Something went wrong!", err);
            res.redirect("/");
        });
});

app.get("/", (req, res) => { res.send("Welcome to your application"); });

app.get("/reorder", async (req, res) => {
    try {
        // Get the tracks of the playlist
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
                console.log("Moved from: " + from + " to: " + to);
            } else {
                console.log("Skipped: " + to + " - " + from);
            }
        }
        res.status(200).send("Playlist reordered successfully");
        console.log("Playlist reordered successfully");
    } catch (err) {
        console.log("Something went wrong", err);
        res.status(500).send("An error occurred while trying to reorder the playlist");
    }
});


app.listen(1234, () => {
    console.log("Server running at http://localhost:1234/authorize");
});


function arraymove(arr, fromIndex, toIndex) {
    var element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
    return arr;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }