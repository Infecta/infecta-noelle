const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bind')
		.setDescription('Bind your osu account to discord')
		.addStringOption((option) =>
			option
				.setName('player_name')
				.setDescription('Player name')
				.setRequired(true),
		),
	async execute(interaction) {
		// Grab user input
		const userInput = interaction.options
			.getString('player_name', true)
			.toLowerCase();
		const mongoURI = process.env.mongoUri;
		const mongoClient = new MongoClient(mongoURI);
		const mongoDB = process.env.mongoDatabase;

		// Check if UserID Exists in DB
		async function checkDBEntriesID(userID) {
			const db = mongoClient.db(mongoDB);
			const collection = db.collection('players');

			try {
				const queryName = { userID: userID };
				const queryResult = await collection.findOne(queryName);

				return queryResult !== null;
			}
			catch (err) {
				console.error(err);
				return false;
			}
			finally {
				mongoClient.close();
			}
		}

		// Send API request
		const queryPlayers = await fetch(`${process.env.osuEndPoint}/v2/players`, {
			method: 'GET',
		});
		// Parse Response
		const response = await queryPlayers.json();
		// Filter to player Array
		const playerArray = response.data;

		// Map Player Names with Their Respective IDs
		const playerMap = new Map();
		playerArray.forEach((player) => playerMap.set(player.safe_name, player.id));

		// Store player names in json object
		const playerSafeNames = {};
		playerArray.forEach((player) => {
			playerSafeNames[player.safe_name] = true;
		});
		// eslint-disable-next-line no-prototype-builtins
		const checkPlayerExists = playerSafeNames.hasOwnProperty(userInput);

		if (!checkPlayerExists) {
			interaction.reply({
				content: `Player ${userInput} does not exist in the server!`,
				ephemeral: true,
			});
			return;
		}

		// DB Connect Function
		async function mongoConnect() {
			try {
				await mongoClient.connect();
			}
			catch (err) {
				interaction.reply({
					content: 'Could not establish a connection to the Database',
					ephemeral: true,
				});
			}
		}

		// Insert data to DB
		async function insertData(collectionName, data) {
			const db = mongoClient.db(mongoDB);
			const collection = db.collection(collectionName);

			try {
				const result = await collection.insertOne(data);
				console.log('Data inserted:', result.insertedId);
			}
			catch (error) {
				console.error('Error inserting document:', error);
			}
		}

		checkDBEntriesID(interaction.user.id).then((IDExists) => {
			if (IDExists) {
				interaction.reply({
					content: 'Discord Account is Already Binded to an Account!',
					ephemeral: true,
				});
				return;
			}
			else {
				mongoConnect()
					.then(() =>
						insertData('players', {
							player: `${userInput}`,
							userID: `${interaction.user.id}`,
							playerID: `${playerMap.get(userInput)}`,
						}),
					)
					.then(() =>
						interaction.reply({ content: 'Binded!', ephemeral: true }),
					)
					.catch((error) => console.error('Error:', error));
			}
		});
	},
};
