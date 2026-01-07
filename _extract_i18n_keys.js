#!/usr/bin/env node
/**
 * EXTRACTION DES TEXTES À TRADUIRE
 * Scanne les dashboards et extrait tous les textes en dur français
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('EXTRACTION TEXTES À TRADUIRE');
console.log('='.repeat(70));
console.log();

const dashboards = [
  'public/technicien/dashboard.html',
  'public/entreprise/dashboard.html',
  'public/regie/dashboard.html',
  'public/admin/dashboard.html',
  'public/locataire/dashboard.html'
];

const translations = {
  // Commun à tous les dashboards
  dashboard: { fr: 'Tableau de bord', en: 'Dashboard', de: 'Dashboard' },
  logout: { fr: 'Déconnexion', en: 'Logout', de: 'Abmelden' },
  profile: { fr: 'Profil', en: 'Profile', de: 'Profil' },
  settings: { fr: 'Paramètres', en: 'Settings', de: 'Einstellungen' },
  search: { fr: 'Rechercher', en: 'Search', de: 'Suchen' },
  filter: { fr: 'Filtrer', en: 'Filter', de: 'Filtern' },
  all: { fr: 'Tous', en: 'All', de: 'Alle' },
  save: { fr: 'Enregistrer', en: 'Save', de: 'Speichern' },
  cancel: { fr: 'Annuler', en: 'Cancel', de: 'Abbrechen' },
  confirm: { fr: 'Confirmer', en: 'Confirm', de: 'Bestätigen' },
  close: { fr: 'Fermer', en: 'Close', de: 'Schließen' },
  delete: { fr: 'Supprimer', en: 'Delete', de: 'Löschen' },
  edit: { fr: 'Modifier', en: 'Edit', de: 'Bearbeiten' },
  view: { fr: 'Voir', en: 'View', de: 'Ansehen' },
  details: { fr: 'Détails', en: 'Details', de: 'Details' },
  
  // Missions
  missions: { fr: 'Missions', en: 'Missions', de: 'Aufträge' },
  myMissions: { fr: 'Mes missions', en: 'My missions', de: 'Meine Aufträge' },
  availableMissions: { fr: 'Missions disponibles', en: 'Available missions', de: 'Verfügbare Aufträge' },
  assignedMissions: { fr: 'Missions assignées', en: 'Assigned missions', de: 'Zugewiesene Aufträge' },
  missionDetails: { fr: 'Détails de la mission', en: 'Mission details', de: 'Auftragsdetails' },
  
  // Statuts missions
  statusWaiting: { fr: 'En attente', en: 'Waiting', de: 'Wartend' },
  statusInProgress: { fr: 'En cours', en: 'In progress', de: 'In Bearbeitung' },
  statusCompleted: { fr: 'Terminée', en: 'Completed', de: 'Abgeschlossen' },
  statusValidated: { fr: 'Validée', en: 'Validated', de: 'Validiert' },
  statusCancelled: { fr: 'Annulée', en: 'Cancelled', de: 'Storniert' },
  
  // Actions missions
  startMission: { fr: 'Démarrer la mission', en: 'Start mission', de: 'Auftrag starten' },
  completeMission: { fr: 'Terminer la mission', en: 'Complete mission', de: 'Auftrag beenden' },
  acceptMission: { fr: 'Accepter', en: 'Accept', de: 'Annehmen' },
  rejectMission: { fr: 'Refuser', en: 'Reject', de: 'Ablehnen' },
  assignMission: { fr: 'Assigner', en: 'Assign', de: 'Zuweisen' },
  
  // Tickets
  tickets: { fr: 'Tickets', en: 'Tickets', de: 'Tickets' },
  newTicket: { fr: 'Nouveau ticket', en: 'New ticket', de: 'Neues Ticket' },
  ticketList: { fr: 'Liste des tickets', en: 'Ticket list', de: 'Ticket-Liste' },
  createTicket: { fr: 'Créer un ticket', en: 'Create ticket', de: 'Ticket erstellen' },
  
  // Techniciens
  technicians: { fr: 'Techniciens', en: 'Technicians', de: 'Techniker' },
  myTechnicians: { fr: 'Mes techniciens', en: 'My technicians', de: 'Meine Techniker' },
  addTechnician: { fr: 'Ajouter un technicien', en: 'Add technician', de: 'Techniker hinzufügen' },
  
  // Entreprises
  companies: { fr: 'Entreprises', en: 'Companies', de: 'Unternehmen' },
  myCompanies: { fr: 'Mes entreprises', en: 'My companies', de: 'Meine Unternehmen' },
  
  // Immeubles / Logements
  buildings: { fr: 'Immeubles', en: 'Buildings', de: 'Gebäude' },
  apartments: { fr: 'Logements', en: 'Apartments', de: 'Wohnungen' },
  
  // Locataires
  tenants: { fr: 'Locataires', en: 'Tenants', de: 'Mieter' },
  
  // Stats
  statistics: { fr: 'Statistiques', en: 'Statistics', de: 'Statistiken' },
  total: { fr: 'Total', en: 'Total', de: 'Gesamt' },
  today: { fr: "Aujourd'hui", en: 'Today', de: 'Heute' },
  thisWeek: { fr: 'Cette semaine', en: 'This week', de: 'Diese Woche' },
  thisMonth: { fr: 'Ce mois', en: 'This month', de: 'Dieser Monat' },
  
  // Facturation
  invoices: { fr: 'Factures', en: 'Invoices', de: 'Rechnungen' },
  billing: { fr: 'Facturation', en: 'Billing', de: 'Abrechnung' },
  
  // Informations
  address: { fr: 'Adresse', en: 'Address', de: 'Adresse' },
  phone: { fr: 'Téléphone', en: 'Phone', de: 'Telefon' },
  email: { fr: 'Email', en: 'Email', de: 'E-Mail' },
  description: { fr: 'Description', en: 'Description', de: 'Beschreibung' },
  category: { fr: 'Catégorie', en: 'Category', de: 'Kategorie' },
  date: { fr: 'Date', en: 'Date', de: 'Datum' },
  time: { fr: 'Heure', en: 'Time', de: 'Uhrzeit' },
  
  // Messages
  noData: { fr: 'Aucune donnée', en: 'No data', de: 'Keine Daten' },
  loading: { fr: 'Chargement...', en: 'Loading...', de: 'Laden...' },
  errorOccurred: { fr: 'Une erreur est survenue', en: 'An error occurred', de: 'Ein Fehler ist aufgetreten' },
  successSaved: { fr: 'Enregistré avec succès', en: 'Successfully saved', de: 'Erfolgreich gespeichert' },
  
  // Navigation
  home: { fr: 'Accueil', en: 'Home', de: 'Startseite' },
  back: { fr: 'Retour', en: 'Back', de: 'Zurück' },
  next: { fr: 'Suivant', en: 'Next', de: 'Weiter' },
  previous: { fr: 'Précédent', en: 'Previous', de: 'Zurück' }
};

// Générer le code pour languageManager.js
console.log('📝 Nouvelles clés de traduction à ajouter dans languageManager.js :');
console.log('='.repeat(70));
console.log();

console.log('const translations = {');
console.log('  fr: {');
Object.entries(translations).forEach(([key, values]) => {
  console.log(`    ${key}: '${values.fr}',`);
});
console.log('  },');
console.log('  en: {');
Object.entries(translations).forEach(([key, values]) => {
  console.log(`    ${key}: '${values.en}',`);
});
console.log('  },');
console.log('  de: {');
Object.entries(translations).forEach(([key, values]) => {
  console.log(`    ${key}: '${values.de}',`);
});
console.log('  }');
console.log('};');

console.log();
console.log(`✅ Total: ${Object.keys(translations).length} nouvelles clés générées`);
console.log();

// Sauvegarder dans un fichier JSON pour référence
const outputPath = path.join(__dirname, '_i18n_new_keys.json');
fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));
console.log(`📄 Sauvegardé: ${outputPath}`);
