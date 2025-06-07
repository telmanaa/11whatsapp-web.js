const { Client, Location, Poll, List, Buttons, LocalAuth } = require('./index');
const qrcode = require('qrcode');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.initialize();

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

let pairingCodeRequested = false;
client.on('qr', async (qr) => {
    console.log('QR code:', qr);
    qrcode.generate(qr, { small: true });

    const pairingCodeEnabled = false;
    if (pairingCodeEnabled && !pairingCodeRequested) {
        const pairingCode = await client.requestPairingCode('96170100100');
        console.log('Pairing code enabled, code: '+ pairingCode);
        pairingCodeRequested = true;
    }
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    console.log('Client is ready!');
    const debugWWebVersion = await client.getWWebVersion();
    console.log(`WWebVersion = ${debugWWebVersion}`);

    client.pupPage.on('pageerror', function(err) {
        console.log('Page error: ' + err.toString());
    });
    client.pupPage.on('error', function(err) {
        console.log('Page error: ' + err.toString());
    });
});

client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);

    if (msg.body === '!ping reply') {
        msg.reply('pong');

    } else if (msg.body === '!ping') {
        client.sendMessage(msg.from, 'pong');

    } else if (msg.body.startsWith('!sendto ')) {
        let number = msg.body.split(' ')[1];
        let messageIndex = msg.body.indexOf(number) + number.length;
        let message = msg.body.slice(messageIndex, msg.body.length);
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        let chat = await msg.getChat();
        chat.sendSeen();
        client.sendMessage(number, message);

    } else if (msg.body.startsWith('!subject ')) {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newSubject = msg.body.slice(9);
            chat.setSubject(newSubject);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body.startsWith('!echo ')) {
        msg.reply(msg.body.slice(6));
    } else if (msg.body.startsWith('!preview ')) {
        const text = msg.body.slice(9);
        msg.reply(text, null, { linkPreview: true });
    } else if (msg.body.startsWith('!desc ')) {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newDescription = msg.body.slice(6);
            chat.setDescription(newDescription);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body === '!leave') {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            chat.leave();
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body.startsWith('!join ')) {
        const inviteCode = msg.body.split(' ')[1];
        try {
            await client.acceptInvite(inviteCode);
            msg.reply('Joined the group!');
        } catch (e) {
            msg.reply('That invite code seems to be invalid.');
        }
    } else if (msg.body.startsWith('!addmembers')) {
        const group = await msg.getChat();
        const result = await group.addParticipants(['number1@c.us', 'number2@c.us', 'number3@c.us']);
        console.log(result);
    } else if (msg.body === '!creategroup') {
        const partitipantsToAdd = ['number1@c.us', 'number2@c.us', 'number3@c.us'];
        const result = await client.createGroup('Group Title', partitipantsToAdd);
        console.log(result);
    } else if (msg.body === '!groupinfo') {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            msg.reply(`
                *Group Details*
                Name: ${chat.name}
                Description: ${chat.description}
                Created At: ${chat.createdAt.toString()}
                Created By: ${chat.owner.user}
                Participant count: ${chat.participants.length}
            `);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body === '!chats') {
        const chats = await client.getChats();
        client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
    } else if (msg.body === '!info') {
        let info = client.info;
        client.sendMessage(msg.from, `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.wid.user}
            Platform: ${info.platform}
        `);
    } else if (msg.body === '!mediainfo' && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        msg.reply(`
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}
        `);
    } else if (msg.body === '!quoteinfo' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();

        quotedMsg.reply(`
            ID: ${quotedMsg.id._serialized}
            Type: ${quotedMsg.type}
            Author: ${quotedMsg.author || quotedMsg.from}
            Timestamp: ${quotedMsg.timestamp}
            Has Media? ${quotedMsg.hasMedia}
        `);
    } else if (msg.body === '!resendmedia' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const attachmentData = await quotedMsg.downloadMedia();
            client.sendMessage(msg.from, attachmentData, { caption: 'Here\'s your requested media.' });
        }
        if (quotedMsg.hasMedia && quotedMsg.type === 'audio') {
            const audio = await quotedMsg.downloadMedia();
            await client.sendMessage(msg.from, audio, { sendAudioAsVoice: true });
        }
    } else if (msg.body === '!isviewonce' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();
            await client.sendMessage(msg.from, media, { isViewOnce: true });
        }
    } else if (msg.body === '!location') {
        await msg.reply(new Location(37.422, -122.084));
        await msg.reply(new Location(37.422, -122.084, { name: 'Googleplex' }));
        await msg.reply(new Location(37.422, -122.084, { address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA' }));
        await msg.reply(new Location(37.422, -122.084, { name: 'Googleplex', address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA', url: 'https://google.com' }));
    } else if (msg.location) {
        msg.reply(msg.location);
    } else if (msg.body.startsWith('!status ')) {
        const newStatus = msg.body.split(' ')[1];
        await client.setStatus(newStatus);
        msg.reply(`Status was updated to *${newStatus}*`);
    } else if (msg.body === '!mentionUsers') {
        const chat = await msg.getChat();
        const userNumber = 'XXXXXXXXXX';
        await chat.sendMessage(`Hi @${userNumber}`, {
            mentions: userNumber + '@c.us'
        });
        await chat.sendMessage(`Hi @${userNumber}, @${userNumber}`, {
            mentions: [userNumber + '@c.us', userNumber + '@c.us']
        });
    } else if (msg.body === '!mentionGroups') {
        const chat = await msg.getChat();
        const groupId = 'YYYYYYYYYY@g.us';
        await chat.sendMessage(`Check the last message here: @${groupId}`, {
            groupMentions: { subject: 'GroupSubject', id: groupId }
        });
        await chat.sendMessage(`Check the last message in these groups: @${groupId}, @${groupId}`, {
            groupMentions: [
                { subject: 'FirstGroup', id: groupId },
                { subject: 'SecondGroup', id: groupId }
            ]
        });
    } else if (msg.body === '!getGroupMentions') {
        const groupId = 'ZZZZZZZZZZ@g.us';
        const msg = await client.sendMessage('chatId', `Check the last message here: @${groupId}`, {
            groupMentions: { subject: 'GroupSubject', id: groupId }
        });
        const groupMentions = await msg.getGroupMentions();
        console.log(groupMentions);
    } else if (msg.body === '!delete') {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.delete(true);
            } else {
                msg.reply('I can only delete my own messages');
            }
        }
    } else if (msg.body === '!pin') {
        const chat = await msg.getChat();
        await chat.pin();
    } else if (msg.body === '!archive') {
        const chat = await msg.getChat();
        await chat.archive();
    } else if (msg.body === '!mute') {
        const chat = await msg.getChat();
        const unmuteDate = new Date();
        unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
        await chat.mute(unmuteDate);
    } else if (msg.body === '!typing') {
        const chat = await msg.getChat();
        chat.sendStateTyping();
    } else if (msg.body === '!recording') {
        const chat = await msg.getChat();
        chat.sendStateRecording();
    } else if (msg.body === '!clearstate') {
        const chat = await msg.getChat();
        chat.clearState();
    } else if (msg.body === '!jumpto') {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            client.interface.openChatWindowAt(quotedMsg.id._serialized);
        }
    } else if (msg.body === '!buttons') {
        let button = new Buttons('Button body', [{ body: 'bt1' }, { body: 'bt2' }, { body: 'bt3' }], 'title', 'footer');
        client.sendMessage(msg.from, button);
    } else if (msg.body === '!list') {
        let sections = [
            { title: 'sectionTitle', rows: [{ title: 'ListItem1', description: 'desc' }, { title: 'ListItem2' }] }
        ];
        let list = new List('List body', 'btnText', sections, 'Title', 'footer');
        client.sendMessage(msg.from, list);
    } else if (msg.body === '!reaction') {
        msg.react('👍');
    } else if (msg.body === '!sendpoll') {
        await msg.reply(new Poll('Winter or Summer?', ['Winter', 'Summer']));
        await msg.reply(new Poll('Cats or Dogs?', ['Cats', 'Dogs'], { allowMultipleAnswers: true }));
        await msg.reply(
            new Poll('Cats or Dogs?', ['Cats', 'Dogs'], {
                messageSecret: [
                    1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
                ]
            })
        );
    } else if (msg.body === '!edit') {
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.edit(msg.body.replace('!edit', ''));
            } else {
                msg.reply('I can only edit my own messages');
            }
        }
    } else if (msg.body === '!updatelabels') {
        const chat = await msg.getChat();
        await chat.changeLabels([0, 1]);
    } else if (msg.body === '!addlabels') {
        const chat = await msg.getChat();
        let labels = (await chat.getLabels()).map((l) => l.id);
        labels.push('0');
        labels.push('1');
        await chat.changeLabels(labels);
    } else if (msg.body === '!removelabels') {
        const chat = await msg.getChat();
        await chat.changeLabels([]);
    } else if (msg.body === '!approverequest') {
        await client.approveGroupMembershipRequests(msg.from, { requesterIds: 'number@c.us' });
        const group = await msg.getChat();
        await group.approveGroupMembershipRequests({ requesterIds: 'number@c.us' });
        const approval = await client.approveGroupMembershipRequests(msg.from, {
            requesterIds: ['number1@c.us', 'number2@c.us']
        });
        console.log(approval);
        await client.approveGroupMembershipRequests(msg.from);
        await client.approveGroupMembershipRequests(msg.from, {
            requesterIds: ['number1@c.us', 'number2@c.us'],
            sleep: 300
        });
        await client.approveGroupMembershipRequests(msg.from, {
            requesterIds: ['number1@c.us', 'number2@c.us'],
            sleep: [100, 300]
        });
        await client.approveGroupMembershipRequests(msg.from, {
            requesterIds: ['number1@c.us', 'number2@c.us'],
            sleep: null
        });
    } else if (msg.body === '!pinmsg') {
        const result = await msg.pin(60);
        console.log(result);
    } else if (msg.body === '!howManyConnections') {
        let deviceCount = await client.getContactDeviceCount(msg.from);
        await msg.reply(`You have *${deviceCount}* devices connected`);
    } else if (msg.body === '!syncHistory') {
        const isSynced = await client.syncHistory(msg.from);
        
        await msg.reply(isSynced ? 'Historical chat is syncing..' : 'There is no historical chat to sync.');
    } else if (msg.body === '!statuses') {
        const statuses = await client.getBroadcasts();
        console.log(statuses);
        const chat = await statuses[0]?.getChat();
        console.log(chat);
    } else if (msg.body === '!sendMediaHD' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const media = await quotedMsg.downloadMedia();
            await client.sendMessage(msg.from, media, { sendMediaAsHd: true });
        }
    } else if (msg.body === '!parseVCard') {
        const vCard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            'FN:John Doe\n' +
            'ORG:Microsoft;\n' +
            'EMAIL;type=INTERNET:john.doe@gmail.com\n' +
            'URL:www.johndoe.com\n' +
            'TEL;type=CELL;type=VOICE;waid=18006427676:+1 (800) 642 7676\n' +
            'END:VCARD';
        const vCardExtended =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            'FN:John Doe\n' +
            'ORG:Microsoft;\n' +
            'item1.TEL:+1 (800) 642 7676\n' +
            'item1.X-ABLabel:USA Customer Service\n' +
            'item2.TEL:+55 11 4706 0900\n' +
            'item2.X-ABLabel:Brazil Customer Service\n' +
            'PHOTO;BASE64:here you can paste a binary data of a contact photo in Base64 encoding\n' +
            'END:VCARD';
        const userId = 'XXXXXXXXXX@c.us';
        await client.sendMessage(userId, vCard);
        await client.sendMessage(userId, vCardExtended);
    } else if (msg.body === '!changeSync') {
        const backgroundSync = await client.setBackgroundSync(true);
        console.log(backgroundSync);
    }
});

client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        // do stuff here
    }

    if (msg.fromMe && msg.body.startsWith('!unpin')) {
        const pinnedMsg = await msg.getQuotedMessage();
        if (pinnedMsg) {
            const result = await pinnedMsg.unpin();
            console.log(result);
        }
    }
});

client.on('message_ciphertext', (msg) => {
    msg.body = 'Waiting for this message. Check your phone.';
    
    // do stuff here
});

client.on('message_revoke_everyone', async (after, before) => {
    console.log(after);
    if (before) {
        console.log(before);
    }
});

client.on('message_revoke_me', async (msg) => {
    console.log(msg.body);
});

client.on('message_ack', (msg, ack) => {
    if (ack == 3) {
        // The message was read
    }
});

client.on('group_join', (notification) => {
    console.log('join', notification);
    notification.reply('User joined.');
});

client.on('group_leave', (notification) => {
    console.log('leave', notification);
    notification.reply('User left.');
});

client.on('group_update', (notification) => {
    console.log('update', notification);
});

client.on('change_state', state => {
    console.log('CHANGE STATE', state);
});

let rejectCalls = true;

client.on('call', async (call) => {
    console.log('Call received, rejecting. GOTO Line 261 to disable', call);
    if (rejectCalls) await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('contact_changed', async (message, oldId, newId, isContact) => {
    const eventTime = (new Date(message.timestamp * 1000)).toLocaleString();

    console.log(
        `The contact ${oldId.slice(0, -5)}` +
        `${!isContact ? ' that participates in group ' +
            `${(await client.getChatById(message.to ?? message.from)).name} ` : ' '}` +
        `changed their phone number\nat ${eventTime}.\n` +
        `Their new phone number is ${newId.slice(0, -5)}.\n`);
});

client.on('group_admin_changed', (notification) => {
    if (notification.type === 'promote') {
        console.log(`You were promoted by ${notification.author}`);
    } else if (notification.type === 'demote')
        console.log(`You were demoted by ${notification.author}`);
});

client.on('group_membership_request', async (notification) => {
    console.log(notification);
    await client.approveGroupMembershipRequestss(notification.chatId, notification.author);
    await client.rejectGroupMembershipRequests(notification.chatId, notification.author);
});

client.on('message_reaction', async (reaction) => {
    console.log('REACTION RECEIVED', reaction);
});

client.on('vote_update', (vote) => {
    console.log(vote);
});
