// Génère une paire de clés VAPID pour Web Push.
// Usage : npm run push:keys
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("# Ajoutez ces lignes dans .env.local (et dans l'environnement de production)");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@carsduel.app");
