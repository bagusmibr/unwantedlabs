// All exports are async to support dynamic imports, avoiding ESM bundling issues
// with firebase-admin in Next.js 15+ with Turbopack

type AdminApp = import("firebase-admin/app").App;

let _adminApp: AdminApp | null = null;

async function getAdminApp(): Promise<AdminApp> {
  if (_adminApp) return _adminApp;

  const { initializeApp, getApps, cert } = await import("firebase-admin/app");

  if (getApps().length > 0) {
    _adminApp = getApps()[0];
  } else {
    // Normalize private key: remove surrounding quotes, convert \n to actual newlines
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const privateKey = rawKey
      .replace(/^["']|["']$/g, "")   // Remove surrounding quotes
      .replace(/\\n/g, "\n");         // Convert \n escape to actual newlines

    _adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return _adminApp!;
}

export async function getAdminAuth() {
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app);
}

export async function getAdminDb() {
  const app = await getAdminApp();
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(app);
}

export function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}
