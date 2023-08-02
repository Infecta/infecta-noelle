const { SlashCommandBuilder } = require('discord.js');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unbind')
		.setDescription('Unbind your osu account to discord'),
	async execute(interaction) {
		const mongoClient = new MongoClient(process.env.mongoUri);
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

		// DB Data Insert Function
		async function deleteData(collectionName, data) {
			const db = mongoClient.db(mongoDB);
			const collection = db.collection(collectionName);

			try {
				const result = await collection.deleteOne(data);

				if (result.deletedCount === 1) {
					console.log('Removed Entry');
				}
				else {
					console.log('User not found or already removed.');
				}
			}
			catch (error) {
				console.error('Error removing entry:', error);
			}
		}

		checkDBEntriesID(interaction.user.id).then((IDExists) => {
			if (!IDExists) {
				interaction.reply({
					content: 'Discord Account is not binded to any osu account',
					ephemeral: true,
				});
				return;
			}
			else {
				mongoConnect()
					.then(() =>
						deleteData('players', { userID: `${interaction.user.id}` }),
					)
					.then(() =>
						interaction.reply({ content: 'Unbinded!', ephemeral: true }),
					)
					.catch((error) => console.error('Error:', error));
			}
		});
	},
};
