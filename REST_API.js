const express = require('express');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
const port = 5000;

// Middleware pour parser les requêtes JSON
app.use(express.json());

// Middleware pour autoriser les requêtes Cross-Origin
app.use(cors());

// Connexion à la base de données MongoDB
const uri = "mongodb+srv://cousicousa59:Supercousi@cluster0.eujqyt6.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect();

// Définition des routes pour l'API
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Recherchez l'utilisateur correspondant dans la collection "livreur"
  const livreurCollection = client.db("delivery").collection("livreur");
  const livreur = await livreurCollection.findOne({ username, password });
  if (livreur) {
    res.json({ role: 'livreur', username });
    return;
  }

  // Si l'utilisateur n'est pas un livreur, recherchez dans la collection "admin"
  const adminCollection = client.db("delivery").collection("admin");
  const admin = await adminCollection.findOne({ username, password });
  if (admin) {
    res.json({ role: 'admin', admin });
    return;
  }

  res.status(404).json({ message: 'Nom d\'utilisateur ou mot de passe invalide' });

});

app.get('/livreurs/positions', async (req, res) => {


  // Récupérer la liste des livreurs avec leur position
  const livreursCollection = client.db("delivery").collection("livreur");
  const livreurs = await livreursCollection.find().toArray();

  // Créer un tableau contenant la position de chaque livreur
  const positions = livreurs.map(livreur => {
    return { username: livreur.username, position: livreur.position.coordinates, phone: livreur.telephone }
  });

  res.json(positions);
});

app.post('/updatePosition', async (req, res) => {


  const livreurCollection = client.db("delivery").collection("livreur");
  const { username, longitude, latitude } = req.body;

  // Mettre à jour la position du livreur correspondant à l'username
  await livreurCollection.updateOne(
    { username },
    { $set: { position: { type: 'Point', coordinates: [longitude, latitude] } } }
  );

  res.status(200).json({ message: 'Position du livreur mise à jour' });

});

app.post('/addLivreurs', async (req, res) => {

  const { username, password, telephone, position, adminName } = req.body;

  // Vérifier si le nom d'utilisateur existe déjà dans la collection "livreur"
  const livreurCollection = client.db("delivery").collection("livreur");
  const existingLivreur = await livreurCollection.findOne({ username });
  if (existingLivreur) {
    return res.status(409).json({ message: 'Le nom d\'utilisateur existe déjà' });
  }

  // Insérer un nouveau livreur dans la collection "livreur" avec le nom de l'admin
  await livreurCollection.insertOne({ username, password, telephone, position, adminName });

  res.status(200).json({ message: 'Livreur ajouté' });

});

app.post('/addAdmins', async (req, res) => {

  const { username, password } = req.body;

  // Vérifier si le nom d'utilisateur existe déjà dans la collection "admin"
  const adminCollection = client.db("delivery").collection("admin");
  const existingAdmin = await adminCollection.findOne({ username });
  if (existingAdmin) {
    return res.status(409).json({ error: true, message: 'Le nom d\'utilisateur existe déjà' });
  }

  // Insérer un nouvel administrateur dans la collection "admin"
  await adminCollection.insertOne({ username, password });

  res.status(200).json({ error: false, message: 'Administrateur ajouté' });

});

app.post('/commandes', async (req, res) => {

  const commandeCollection = client.db("delivery").collection("commandes");
  const { nomLivreur, phone, adresse, produit, quantite, prix } = req.body;
  const commande = { nomLivreur, phone, adresse, produit, quantite, prix, supprimer: false };

  // Ajouter le champ "admin" à la commande
  commande.admin = req.body.username; // l'ID ou le nom de l'administrateur qui a effectué la création de la commande

  // Insérer la commande dans la collection "commandes" en utilisant insertOne pour créer un nouveau document à chaque nouvelle commande
  const result = await commandeCollection.insertOne(commande);

  res.status(201).json({ message: 'Commande ajoutée avec succès', id: result.insertedId });

});

app.get('/livreurs/:username/courses', async (req, res) => {

  // Récupérer le nom du livreur depuis la collection "livreur"
  const livreurCollection = client.db("delivery").collection("livreur");
  const livreur = await livreurCollection.findOne({ username: req.params.username });
  if (!livreur) {
    res.status(404).json({ message: 'Livreur introuvable' });
    return;
  }

  // Rechercher toutes les commandes effectuées par ce livreur
  const commandeCollection = client.db("delivery").collection("commandes");
  const commandes = await commandeCollection.find({ nomLivreur: livreur.username, supprimer: false }).toArray();
  const nomsDeCommandes = commandes.map(commande => ({
    id: commande._id, // Ajouter l'id de la commande à l'objet
    phone: commande.phone,
    nomLivreur: commande.nomLivreur,
    produit: commande.produit,
    admin: commande.admin,
    adresse: commande.adresse,
    prix: commande.prix
  }));

  // Retourner les noms des commandes effectuées
  res.status(200).json({ nomsDeCommandes, count: commandes.length });

});

app.get('/livreurs', async (req, res) => {

  const livreurCollection = client.db("delivery").collection("livreur");
  const livreurs = await livreurCollection.find().toArray();
  res.json(livreurs);

});

app.get('/commandes/livreur/:nomLivreur/nombre', async (req, res) => {

  console.log("Connected to MongoDB");

  const commandesCollection = client.db("delivery").collection("commandes");
  const livreursCollection = client.db("delivery").collection("livreur");
  const { nomLivreur } = req.params;

  if (!nomLivreur) {
    console.log("Le nom du livreur est requis");
    return res.status(400).json({ message: 'Le nom du livreur est requis' });
  }

  console.log("Looking for orders for", nomLivreur);

  // Récupérer l'ID du livreur correspondant au nom dans la collection "livreur"
  const livreur = await livreursCollection.findOne({ username: nomLivreur });

  // Utiliser l'ID du livreur pour chercher les commandes associées dans la collection "commande"
  const nombreCommandes = await commandesCollection.countDocuments({ nomLivreur: nomLivreur.toLowerCase() });
  console.log("Found", nombreCommandes, "orders for", nomLivreur);

  res.json({ nombreCommandes });

});

app.put('/commandes/:id', async (req, res) => {
  const commandeCollection = client.db("delivery").collection("commandes");

  const filter = { _id: new ObjectId(req.params.id) }; // Utiliser l'id dans la requête pour filtrer le document à mettre à jour
  const update = { $set: { supprimer: true } }; // Mettre à jour la colonne "supprimer" à true

  const result = await commandeCollection.updateOne(filter, update);

  if (result.modifiedCount === 0) {
    return res.status(404).json({ message: 'Commande introuvable' });
  }

  res.status(200).json({ message: 'Commande supprimée avec succès' });

});

app.post('/sendMessage', async (req, res) => {
  const { sender, recipient, message } = req.body;

  // Vérifier que le destinataire existe dans la collection "users" ou "admin"
  const usersCollection = client.db("delivery").collection("livreur");
  const adminCollection = client.db("delivery").collection("admin");
  const userExists = await usersCollection.findOne({ username: recipient });
  const adminExists = await adminCollection.findOne({ username: recipient });
  if (!userExists && !adminExists) {
    return res.status(400).json({ message: 'Destinataire inconnu' });
  }

  // Vérifier que le message n'est pas vide
  if (!message) {
    return res.status(400).json({ message: 'Le message ne peut pas être vide' });
  }

  // Insérer le message dans la collection "messages"
  const messagesCollection = client.db("delivery").collection("messages");
  await messagesCollection.insertOne({ sender, recipient, message });

  res.status(200).json({ message: 'Message envoyé avec succès' });

});

app.get('/messages/:recipient', async (req, res) => {

  const recipient = req.params.recipient;

  // Récupérez tous les messages pour le destinataire spécifié
  const messagesCollection = client.db("delivery").collection("messages");
  const messages = await messagesCollection.find({ recipient }).toArray();

  res.json(messages);

});

app.delete('/messages/:id', async (req, res) => {

  const id = req.params.id;

  // Supprimez le message avec l'ID spécifié
  const messagesCollection = client.db("delivery").collection("messages");
  const result = await messagesCollection.deleteOne({ _id: ObjectId(id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Le message n'a pas été trouvé" });
  }

  res.json({ message: "Le message a été supprimé avec succès" });

});

app.get('/usernames', async (req, res) => {

  const livreurCollection = client.db("delivery").collection("livreur");
  const adminCollection = client.db("delivery").collection("admin");

  const livreurUsernames = await livreurCollection.distinct('username');
  const adminUsernames = await adminCollection.distinct('username');

  const usernames = [...livreurUsernames, ...adminUsernames];

  res.json(usernames);

});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});

