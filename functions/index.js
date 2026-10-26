const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Recalcula el documento consolidado de estadísticas para un usuario específico.
 * En lugar de promedios planos (flat averages), calcula distribuciones de frecuencia
 * por emoción (Issue #140) y moda dominante, consolidando en stats_summary/latest (Issue #158).
 */
async function computeAndSaveUserStats(userId) {
  if (!userId) return;

  const [checkinsSnap, toolsSnap] = await Promise.all([
    db.collection(`users/${userId}/mood_checkins`).get(),
    db.collection(`users/${userId}/tool_interactions`).get()
  ]);

  const totalCheckIns = checkinsSnap.size;
  const totalToolEntries = toolsSnap.size;

  // 1. Distribución de frecuencia por emoción (Issue #140: reemplaza flat averages)
  const emotionFrequencies = {};
  const dayEmotions = { Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {} };
  const dayIntensities = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  checkinsSnap.forEach((doc) => {
    const data = doc.data();
    const emotion = (data.emotion || "CALM").toUpperCase();
    const intensity = Number(data.intensity) || 3;
    const timestamp = data.timestamp || data.createdAt || Date.now();
    const date = new Date(timestamp);
    const day = daysOfWeek[date.getDay()];

    emotionFrequencies[emotion] = (emotionFrequencies[emotion] || 0) + 1;

    if (dayEmotions[day]) {
      dayEmotions[day][emotion] = (dayEmotions[day][emotion] || 0) + 1;
    }
    if (dayIntensities[day]) {
      dayIntensities[day].push(intensity);
    }
  });

  // 2. Emoción más frecuente (Top Feeling / Moda)
  let topEmotion = "CALM";
  let maxFreq = 0;
  for (const [em, count] of Object.entries(emotionFrequencies)) {
    if (count > maxFreq) {
      maxFreq = count;
      topEmotion = em;
    }
  }

  // 3. Trayectoria semanal y emoción dominante por día (Weekly Journey)
  const weeklyEmotions = {};
  const weeklyIntensities = {};
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    let dominantDayEmotion = "CALM";
    let maxDayCount = 0;
    for (const [em, count] of Object.entries(dayEmotions[d])) {
      if (count > maxDayCount) {
        maxDayCount = count;
        dominantDayEmotion = em;
      }
    }
    weeklyEmotions[d] = dominantDayEmotion;

    const intensities = dayIntensities[d];
    weeklyIntensities[d] = intensities.length > 0
      ? Number((intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(1))
      : 0.0;
  }

  // 4. Porcentajes de uso de herramientas
  const toolCounts = {};
  toolsSnap.forEach((doc) => {
    const data = doc.data();
    const tool = data.toolName || data.toolId || "Breathing Pacer";
    toolCounts[tool] = (toolCounts[tool] || 0) + 1;
  });

  const toolUsagePercentages = {};
  for (const [tool, count] of Object.entries(toolCounts)) {
    toolUsagePercentages[tool] = totalToolEntries > 0
      ? Number(((count / totalToolEntries) * 100).toFixed(1))
      : 0;
  }

  // 5. Recomendación conductual amigable
  let currentInsight = "Continúa registrando tu estado de ánimo para desbloquear recomendaciones personalizadas.";
  if (totalCheckIns >= 3) {
    if (topEmotion === "CALM" || topEmotion === "HAPPINESS") {
      currentInsight = "Has mantenido un balance positivo esta semana. Sigue con tus pausas de respiración.";
    } else {
      currentInsight = "Completas la mayoría de check-ins en la noche. Una pausa de respiración a media tarde te ayudará a equilibrar tu día.";
    }
  }

  // 6. Escritura del documento consolidado en la ruta que la app consume
  await db.doc(`users/${userId}/stats_summary/latest`).set({
    totalCheckIns,
    totalToolEntries,
    topEmotion,
    emotionFrequencies,
    weeklyEmotions,
    weeklyIntensities,
    toolUsagePercentages,
    currentInsight,
    updatedAt: Date.now()
  }, { merge: true });
}

// Disparador cuando el usuario registra un nuevo check-in
exports.onMoodCheckInCreated = functions.firestore
  .document("users/{userId}/mood_checkins/{checkInId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    await computeAndSaveUserStats(userId);
  });

// Disparador cuando el usuario completa una interacción con una herramienta
exports.onToolInteractionCreated = functions.firestore
  .document("users/{userId}/tool_interactions/{interactionId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    await computeAndSaveUserStats(userId);
  });
