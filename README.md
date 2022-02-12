# Tribble
Tribble is a discord.js payment bot based off of [discord.js-menu](https://github.com/jowsey/discord.js-menu) that creates tickets and automatically validates payments.

## Screenshots

<img width="480" alt="image" src="https://user-images.githubusercontent.com/37427166/112679142-d3a4b900-8e39-11eb-919a-c1a6611ec26c.png">
<img width="480" alt="image" src="https://user-images.githubusercontent.com/37427166/112678924-8b859680-8e39-11eb-86c8-a2896658926d.png">



## Features
* Creates individual ticket channels in your server for payments.
* Generates a unique ticket code so payments have a minimal chance of being repeated.
* Automates payments received of your choice (currently supports Venmo, PayPal, and Cash App)

## Setup and Configuration
For first time installation and configuration, view the [Wiki](https://github.com/FivePixels/Tribble/wiki).

## Contributing
All contributions are welcome. 

Make sure there are no changes made to the original `.env` file. If there are changes made,  run `git checkout HEAD -- .env` to reset it. 

Now, create a copy of the original `.env` file by running `cp .env dev.env`. This creates a file named `dev.env` you will modify when contributing and testing Tribble. 

Next, make sure to set the `dev` variable.

**index.js**
```js
dev = true; // Change this if you are contributing to Tribble.
```

Before making a pull request, make sure the state of the repository is one in which a user could use without issues. This means, make sure that you set the `dev` variable back to `false` when you are ready to commit.


## Acknowledgements
* [discord.js-menu](https://github.com/jowsey/discord.js-menu) by Jowsey
* [DiscordTickets](https://github.com/discord-tickets/bot) and [leekslazylogger](https://github.com/eartharoid/leekslazylogger) by eartharoid
* [googleapis](https://github.com/googleapis/google-api-nodejs-client) by Google
