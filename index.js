/**
 *
 *  @name Tribble
 *  @author Dylan Bolger (FivePixels) <o5pxels@gmail.com>
 *  @license MIT
 *
 * Tribble Copyright (C) 2021 Dylan Bolger (FivePixels)
 *
 * This is free software, and you are welcome to redistribute it
 * under certain conditions. See the included LICENSE file for details.
 *
 */

dev = true;
require('dotenv').config({ path: dev ? 'dev.env' : '.env' });
const Discord = require('discord.js');
const Logger = require('leekslazylogger');
const log = new Logger({
    name: "Tribble",
    keepSilent: true
});
const client = new Discord.Client({
    autoReconnect: true,
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});
const enmap = require('enmap');
const { google } = require('googleapis');
const { Menu } = require('discord.js-menu');

const settings = new enmap({
    name: "settings",
    autoFetch: true,
    cloneLevel: "deep",
    fetchAll: true
});

// check for all required variables
if (!process.env.DISCORD_TOKEN ||
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN ||
    !process.env.GUILD_ID ||
    !process.env.TICKET_CATEGORY_ID ||
    !process.env.PURCHASED_ROLE_ID) {
    log.error('At least one required field is missing from the configuration. Check your .env file.');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)

var auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

async function checkForEmail(auth, payment, code) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: `${payment} ${code} ${process.env.PAYMENT_AMOUNT}`
    })
    const messages = res.data.messages;
    if (messages) {
        log.info("An email was found with the searched parameters.");
        return true;
    } else {
        return false;
    }
}

client.on('ready', async () => {
    log.success(`Authenticated as ${client.user.tag}`);
    client.user.setPresence({
        activity: {
            name: process.env.PRESENCE_ACTIVITY,
            type: process.env.PRESENCE_TYPE.toUpperCase()
        }
    })
    if (client.guilds.cache.get(process.env.GUILD_ID).member(client.user).hasPermission('ADMINISTRATOR', false)) {
        log.success('Bot has the \'ADMINISTRATOR\' permission');
    } else log.warn('Bot does not have \'ADMINISTRATOR\' permission');
    purchasedRole = client.guilds.cache.get(process.env.GUILD_ID).roles.cache.get(process.env.PURCHASED_ROLE_ID);
    if (process.env.USE_CASHAPP) {
        cashappEmoji = client.emojis.cache.find(emoji => emoji.name === "cashapp");
        if (!cashappEmoji) {
            log.error(`Cash App emoji was not found. The emoji must be named "cashapp".`)
            process.exit(1)
        }
        caEmojiID = cashappEmoji.id;
    }
    if (process.env.USE_VENMO) {
        venmoEmoji = client.emojis.cache.find(emoji => emoji.name === "venmo");
        if (!venmoEmoji) {
            log.error(`Venmo emoji was not found. The emoji must be named "venmo".`)
            process.exit(1)
        }
        vEmojiID = venmoEmoji.id;
    }
    if (process.env.USE_PAYPAL) {
        paypalEmoji = client.emojis.cache.find(emoji => emoji.name === "paypal");
        if (!paypalEmoji) {
            log.error(`PayPal emoji was not found. The emoji must be named "paypal".`)
            process.exit(1)
        }
        ppEmojiID = paypalEmoji.id;
    }
})

client.on('message', async message => {
    if (message.content === `${process.env.COMMAND_PREFIX}close`) {
        message.channel.delete();
    }
    if (message.content === `${process.env.COMMAND_PREFIX}panel`) {
        let panel;
        let channel = message.channel;
        let messageID = settings.get('panel_message_id');
        let channelID = settings.get('panel_channel_id');
        if (!channelID) {
            settings.set('panel_channel_id', message.channel.id);
            channelID = settings.get('panel_channel_id');
        }
        if (!messageID) {
            settings.set('panel_message_id', '');
        } else {
            try {
                panel = await client.channels.cache.get(channelID).messages.fetch(messageID);
                if (panel) {
                    panel.delete().then(() => log.info('Deleted previous panel')).catch(e => log.warn(e));
                }
            }
            catch (error) {
                log.error(error)
                log.error('Error deleting panel')
            }
        }
        message.delete();
        panel = await channel.send(new Discord.MessageEmbed()
            .setTitle(process.env.PANEL_TITLE)
            .setDescription(process.env.PANEL_DESCRIPTION)
            .setColor(process.env.PANEL_COLOR)
            .setFooter(process.env.PANEL_FOOTER)
            .setThumbnail(process.env.PANEL_THUMBNAIL)
        )
        log.info('New panel created successfully')
        panel.react(process.env.PANEL_REACT_EMOJI)
        settings.set('panel_message_id', panel.id)
    }
})

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.message.id == settings.get('panel_message_id') && reaction.emoji.name == process.env.PANEL_REACT_EMOJI) {
        reaction.users.remove(user); // remove the reaction
        if (settings.get(`${user.id}`)) {
            id = settings.get(`${user.id}`)
            prevChannel = reaction.message.guild.channels.cache.find(channel => channel.name === `ticket-${id}`);
            if (typeof prevChannel !== 'undefined') {
                prevChannel.delete()
            }
        }
        var identifier = Math.floor(100000 + Math.random() * 900000); // generate a random, six-digit number.
        var ticket = `ticket-${identifier}`;
        reaction.message.guild.channels.create(ticket, {
            parent: process.env.TICKET_CATEGORY_ID,
            permissionOverwrites: [{
                id: user.id,
                allow: ["VIEW_CHANNEL"],
                deny: ["SEND_MESSAGES"]
            },
            {
                id: reaction.message.guild.roles.everyone,
                deny: ["VIEW_CHANNEL"]
            }
            ],
            type: 'text'
        }).then(async channel => {
            ticketMember = reaction.message.guild.members.cache.get(user.id)
            identifier = identifier;
            settings.set(`${user.id}`, `${identifier}`);
            let menu = new Menu(channel, user.id, [
                {
                    name: 'intro',
                    content: new Discord.MessageEmbed({
                        title: 'Terms of Service',
                        color: process.env.MENU_COLOR,
                        description: process.env.MENU_INTRO_TEXT,
                        fields: [
                            {
                                name: "Agree",
                                value: "✅",
                                inline: true
                            },
                            {
                                name: "Cancel transaction",
                                value: "❌",
                                inline: true
                            }
                        ]
                    }),
                    reactions: {
                        '✅': async () => {
                            menu.setPage(1)
                        },
                        '❌': async () => {
                            menu.stop()
                            if (channel) {
                                channel.delete();
                            }
                        }
                    },
                },
                {
                    name: 'main',
                    content: new Discord.MessageEmbed({
                        title: 'Select a Payment Method',
                        color: process.env.MENU_COLOR,
                        description: 'React with the payment method you are using to make the purchase.\n\n',
                        fields: [
                            {
                                name: "Cash App",
                                value: "🇨",
                                inline: true
                            },
                            {
                                name: "Venmo",
                                value: "🇻",
                                inline: true
                            },
                            {
                                name: "PayPal",
                                value: "🇵",
                                inline: true
                            },
                            {
                                name: "Cancel transaction",
                                value: "❌",
                                inline: true
                            },
                        ]
                    }),
                    reactions: {
                        '🇨': async () => {
                            selected = "cashapp";
                            menu.setPage(2);
                        },
                        '🇻': async () => {
                            selected = "venmo";
                            menu.setPage(3);
                        },
                        '🇵': async () => {
                            selected = "paypal";
                            menu.setPage(4);
                        },
                        '❌': async () => {
                            menu.stop()
                            if (channel) {
                                channel.delete();
                            }
                        }
                    }
                },
                {
                    name: 'cashapp',
                    content: new Discord.MessageEmbed({
                        title: `You\'ve selected Cash App.`,
                        description: `Send the **exact** amount of \`${process.env.PAYMENT_AMOUNT} ${process.env.PAYMENT_CURRENCY}\` to \`$${process.env.CASHAPP_USERNAME}\` on Cash App.\n\n**__DO NOT FORGET TO SEND THE CODE IN THE NOTE.__**\n\nFor the note, type the **exact** code below: \`\`\`${identifier}\`\`\``,
                        color: process.env.MENU_COLOR,
                        fields: [
                            {
                                name: "Return to payment selection",
                                value: "◀",
                                inline: true
                            },
                            {
                                name: "Payment has been sent",
                                value: "✅",
                                inline: true
                            },
                            {
                                name: "Cancel transaction",
                                value: "❌",
                                inline: true
                            }
                        ]
                    }),
                    reactions: {
                        '◀': 'main',
                        '✅': async () => {
                            try {
                                menu.setPage(5);
                                checkForEmail(auth, selected, identifier).then((result) => {
                                    if (menu && result) {
                                        menu.setPage(7);
                                        ticketMember.roles.add(purchasedRole).catch(console.error);
                                    } else if (menu) {
                                        menu.setPage(6);
                                    } else {
                                        return;
                                    }
                                })
                            } catch (error) {
                                log.error(error)
                            }
                        },
                        '❌': async () => {
                            menu.stop()
                            if (channel) {
                                channel.delete();
                            }
                        }
                    }
                },
                {
                    name: 'venmo',
                    content: new Discord.MessageEmbed({
                        title: `You\'ve selected Venmo.`,
                        description: `Please send the **exact** amount of \`${process.env.PAYMENT_AMOUNT} ${process.env.PAYMENT_CURRENCY}\`  to \`@${process.env.VENMO_USERNAME}\` on Venmo.\n\n**__DO NOT FORGET TO SEND THE CODE IN THE NOTE.__**\n\nFor the note, type the **exact** code below: \`\`\`${identifier}\`\`\`\nIf Venmo asks for last 4 digits: \`${process.env.VENMO_4_DIGITS}\``,
                        color: process.env.MENU_COLOR,
                        fields: [
                            {
                                name: "Return to payment selection",
                                value: "◀",
                                inline: true
                            },
                            {
                                name: "Payment has been sent",
                                value: "✅",
                                inline: true
                            },
                            {
                                name: "Cancel transaction",
                                value: "❌",
                                inline: true
                            }
                        ]
                    }),
                    reactions: {
                        '◀': 'main',
                        '✅': async () => {
                            try {
                                menu.setPage(5);
                                checkForEmail(auth, selected, identifier).then((result) => {
                                    if (menu && result) {
                                        menu.setPage(7);
                                        ticketMember.roles.add(purchasedRole).catch(console.error);
                                    } else if (menu) {
                                        menu.setPage(6);
                                    } else {
                                        return;
                                    }
                                })
                            } catch (error) {
                                log.error(error)
                            }
                        },
                        '❌': async () => {
                            menu.stop();
                            if (channel) {
                                channel.delete();
                            }
                        }
                    }
                },
                {
                    name: 'paypal',
                    content: new Discord.MessageEmbed({
                        title: `You've selected PayPal.`,
                        description: `Please send the **exact** amount of \`${process.env.PAYMENT_AMOUNT} ${process.env.PAYMENT_CURRENCY}\` to ${process.env.PAYPALME_LINK}.\n\n**__DO NOT FORGET TO SEND THE CODE IN THE NOTE.__**\n\nFor the note, type the **exact** code below: \`\`\`${identifier}\`\`\``,
                        color: process.env.MENU_COLOR,
                        fields: [
                            {
                                name: "Return to payment selection",
                                value: "◀",
                                inline: true
                            },
                            {
                                name: "Payment has been sent",
                                value: "✅",
                                inline: true
                            },
                            {
                                name: "Cancel transaction",
                                value: "❌",
                                inline: true
                            }
                        ]
                    }),
                    reactions: {
                        '◀': 'main',
                        '✅': async () => {
                            try {
                                menu.setPage(5);
                                checkForEmail(auth, selected, identifier).then((result) => {
                                    if (menu && result) {
                                        menu.setPage(7);
                                        ticketMember.roles.add(purchasedRole).catch(console.error);
                                    } else if (menu) {
                                        menu.setPage(6);
                                    } else {
                                        return;
                                    }
                                })
                            } catch (error) {
                                log.error(error)
                            }
                        },
                        '❌': async () => {
                            menu.stop();
                            if (channel) {
                                channel.delete();
                            }
                        }
                    }
                },
                {
                    name: 'check',
                    color: process.env.MENU_COLOR,
                    content: new Discord.MessageEmbed({
                        title: `Checking for payment...`,
                        description: 'Checking for your payment...',
                    })
                },
                {
                    name: 'fail',
                    color: process.env.MENU_COLOR,
                    content: new Discord.MessageEmbed({
                        title: `Payment unsuccessful`,
                        description: 'No payment detected. Try to check for the payment again after you\'ve sent it.',
                        fields: [
                            {
                                name: "Return to payment instructions",
                                value: "◀",
                                inline: true
                            },
                            {
                                name: "Check for payment again",
                                value: "🔄",
                                inline: true
                            },

                        ]
                    }),
                    reactions: {
                        '◀': async () => {
                            switch (selected) {
                                case "cashapp":
                                    menu.setPage(2);
                                    break;
                                case "venmo":
                                    menu.setPage(3);
                                    break;
                                case "paypal":
                                    menu.setPage(4);
                                    break;
                            }
                        },
                        '🔄': async () => {
                            switch (selected) {
                                case "cashapp":
                                    menu.setPage(5);
                                    checkForEmail(auth, selected, identifier).then((result) => {
                                        if (result) {
                                            //success
                                            menu.setPage(7);
                                            id = settings.get(`${user.id}`)
                                            ticketMember.roles.add(purchasedRole).catch(console.error);
                                        } else {
                                            //fail
                                            menu.setPage(6);
                                        }
                                    })
                                    break;
                                case "venmo":
                                    menu.setPage(5);
                                    checkForEmail(auth, selected, identifier).then((result) => {
                                        if (result) {
                                            //success
                                            menu.setPage(7);
                                            id = settings.get(`${user.id}`)
                                            ticketMember.roles.add(purchasedRole).catch(console.error);
                                        } else {
                                            //fail
                                            menu.setPage(6);
                                        }
                                    })
                                    break;
                                case "paypal":
                                    menu.setPage(5);
                                    checkForEmail(auth, selected, identifier).then((result) => {
                                        if (result) {
                                            //success
                                            menu.setPage(7);
                                            ticketMember.roles.add(purchasedRole).catch(console.error);
                                        } else {
                                            //fail
                                            menu.setPage(6);
                                        }
                                    })
                                    break;
                            }
                        }
                    }
                },
                {
                    name: 'success',
                    color: process.env.MENU_COLOR,
                    content: new Discord.MessageEmbed({
                        title: `Payment Successful`,
                        description: `Your payment has been received! You have been granted access to the ${purchasedRole.name} role. Thank you!`,
                        fields: [
                            {
                                name: "Close ticket",
                                value: "✅",
                                inline: true
                            }
                        ]
                    }),
                    reactions: {
                        '✅': async () => {
                            menu.stop()
                            if (channel) {
                                channel.delete();
                            }
                            settings.delete(`${user.id}`)
                        }
                    }
                }
            ], 300000);
            menu.start();
            channel.send(`<@${user.id}>, your unique ticket code is \`${identifier}\`.`)
        }).catch(log.error)
    } else {
        return;
    }
})

