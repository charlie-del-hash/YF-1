/**
 * Every user-facing string in Dorsal. CLAUDE.md rule 1: a Spanish string
 * written inline in a component is a bug, and lib/copy/no-inline-copy.test.ts
 * fails the build over it.
 *
 * Voice (03-DESIGN-BRIEF): Spanish from Spain, tuteo always, peninsular
 * vocabulary, plain verbs, sentence case. A button says exactly what happens
 * and the word survives the whole flow — `Me apunto` becomes `Te has
 * apuntado`, never `Enviar` then `Éxito`. Nothing flirty, ever: if a string
 * could appear in a dating app, it gets rewritten.
 *
 * A second locale is this file again, not a refactor.
 */
export const copy = {
  app: {
    name: 'Dorsal',
    tagline: 'Quedadas deportivas en Madrid',
    lang: 'es-ES',
    skipToContent: 'Saltar al contenido',
  },

  nav: {
    deck: 'Planes',
    myPlans: 'Mis planes',
    profile: 'Mi dorsal',
    create: 'Crear plan',
  },

  auth: {
    title: 'Entra en Dorsal',
    intro: 'Te mandamos un enlace por correo. Sin contraseñas.',
    emailLabel: 'Tu correo',
    emailPlaceholder: 'tu@correo.com',
    submit: 'Mandarme el enlace',
    sending: 'Mandando…',
    sent: 'Mírate el correo. El enlace caduca en una hora.',
    sentAgain: 'Te lo hemos vuelto a mandar.',
    checkSpam: 'Si no aparece, mira en spam.',
    signOut: 'Cerrar sesión',
    ageNotice: 'Dorsal es para mayores de 18 años.',
    errors: {
      invalidEmail: 'Ese correo no parece válido.',
      rateLimited: 'Espera un minuto antes de pedir otro enlace.',
      generic: 'No hemos podido mandarte el enlace. Vuelve a intentarlo.',
      expiredLink: 'Ese enlace ya no vale. Pide uno nuevo.',
    },
  },

  onboarding: {
    stepOf: (n: number, total: number) => `Paso ${n} de ${total}`,
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Listo',
    saving: 'Guardando…',

    sports: {
      title: '¿A qué juegas?',
      help: 'Elige uno o varios. Podrás cambiarlo luego.',
      error: 'Elige al menos un deporte.',
    },
    levels: {
      title: (sport: string) => `¿Qué nivel tienes en ${sport}?`,
      titleRunning: '¿A qué ritmo corres?',
      help: 'Sé sincero, es mejor para todos.',
      error: 'Marca tu nivel para seguir.',
    },
    zone: {
      title: '¿Por dónde te mueves?',
      help: 'Elige tu distrito y cuánto estás dispuesto a desplazarte.',
      distritoLabel: 'Distrito',
      travelLabel: 'Hasta cuánto te desplazas',
      travelValue: (km: number) => `${km} km`,
      error: 'Elige un distrito.',
    },
    identity: {
      title: 'Tu dorsal',
      help: 'Una foto donde se te vea la cara. Es lo que verá la gente antes de quedar contigo.',
      nameLabel: 'Cómo te llamas',
      namePlaceholder: 'Tu nombre',
      birthYearLabel: 'Año de nacimiento',
      photoLabel: 'Foto',
      photoAdd: 'Añadir foto',
      photoChange: 'Cambiar foto',
      photoSkip: 'Puedes añadirla luego, pero mucha gente no se apunta a un plan sin ver quién va.',
      genderLabel: 'Género',
      genderHelp:
        'Opcional. Solo se usa para los planes solo para mujeres y no aparece en tu perfil.',
      genderOptions: {
        mujer: 'Mujer',
        hombre: 'Hombre',
        no_binario: 'No binario',
        prefiero_no_decirlo: 'Prefiero no decirlo',
      },
      errors: {
        name: 'Escribe un nombre de entre 2 y 40 caracteres.',
        birthYear: 'Escribe tu año de nacimiento.',
        under18: 'Dorsal es para mayores de 18 años.',
      },
    },
    done: {
      title: (name: string) => `Ya estás dentro, ${name}`,
      body: 'Estos son los planes que te encajan.',
      cta: 'Ver planes',
    },
  },

  deck: {
    title: 'Planes cerca de ti',
    join: 'Me apunto',
    pass: 'Paso',
    open: 'Ver el plan',
    joined: 'Dentro',
    joinedToast: 'Te has apuntado.',
    joinedToastWithDay: (day: string) => `Te has apuntado. Nos vemos el ${day}.`,
    waitlisted: 'Estás en la lista de espera. Te avisamos si se cae alguien.',
    viewList: 'Ver en lista',
    viewCards: 'Ver en fichas',
    keyboardHelp: 'Usa las flechas para pasar y Enter para abrir el plan.',
    remaining: {
      last: 'Última plaza',
      some: (n: number) => `Quedan ${n} plazas`,
      full: 'Completo',
      count: (taken: number, total: number) => `${taken} de ${total}`,
    },
    empty: {
      title: 'Por aquí no hay nada esta semana.',
      body: 'Crea tú el plan y te ayudamos a llenarlo.',
      cta: 'Crear un plan',
    },
    exhausted: {
      title: 'Ya los has visto todos.',
      body: 'Vuelve mañana o amplía el radio desde tu perfil.',
      cta: 'Ampliar mi zona',
    },
    filters: {
      title: 'Filtros',
      sport: 'Deporte',
      when: 'Cuándo',
      level: 'Nivel',
      womenOnly: 'Solo mujeres',
      withThirdHalf: 'Con tercer tiempo',
      apply: 'Ver planes',
      clear: 'Quitar filtros',
      any: 'Cualquiera',
      whenOptions: {
        any: 'Cualquier día',
        today: 'Hoy',
        tomorrow: 'Mañana',
        week: 'Esta semana',
        weekend: 'El finde',
      },
      timeOfDay: { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' },
    },
  },

  plan: {
    meetingPoint: 'Punto de encuentro',
    level: 'Nivel',
    who: 'Quién va',
    after: 'Después',
    note: 'Del anfitrión',
    hostedBy: (name: string) => `Organiza ${name}`,
    duration: (min: number) => `${min} min`,
    unverifiedVenue: 'Sitio por confirmar. Poneos de acuerdo en el chat antes de ir.',
    publicPlaceNote: 'Quedamos siempre en sitios públicos.',
    mapUnavailable: 'El mapa no está disponible ahora mismo.',
    openInMaps: 'Cómo llegar',
    leave: 'Salirme del plan',
    leaveConfirmLate: 'Si te sales ahora quedan menos de 12 h y cuenta como falta. ¿Seguro?',
    leaveConfirmEarly: 'Avisa cuanto antes si no puedes ir. Otra persona ocupará tu plaza.',
    leaveCancel: 'Me quedo',
    leaveConfirm: 'Salirme',
    left: 'Te has salido del plan.',
    seedNotice: 'Plan de ejemplo mientras arrancamos en tu zona.',
    thirdHalf: {
      cafe: 'Después: café',
      cana: 'Después: caña',
      desayuno: 'Después: desayuno',
      comida: 'Después: comida',
      ninguno: 'Sin plan después',
    },
    thirdHalfAt: (label: string, venue: string) => `${label} en ${venue}`,
    audience: {
      solo_mujeres: 'Solo mujeres',
      todos: '',
    },
    gate: (n: number) => `Para gente con ${n} planes o más`,
  },

  profile: {
    dorsalNumber: 'Dorsal',
    plansAttended: (n: number) => `${n} planes`,
    attendance: (pct: number) => `${pct}% asistencia`,
    newcomer: 'Nuevo por aquí',
    sports: 'Deportes',
    zone: 'Zona',
    travel: (km: number) => `Hasta ${km} km`,
    edit: 'Editar mi dorsal',
    verified: 'Verificado',
  },

  chat: {
    title: 'Chat del plan',
    placeholder: 'Escribe al grupo',
    send: 'Enviar',
    onlyThisPlan: 'Solo puedes escribir con la gente de este plan.',
    closesAfter: 'Este chat se cierra 48 h después del plan.',
    closed: 'Este chat ya está cerrado.',
    pin: 'Fijar mensaje',
    pinned: 'Fijado',
  },

  attendance: {
    hostTitle: '¿Quién vino?',
    hostHelp: 'Marca a quien apareció. Tarda diez segundos y es lo que mantiene esto en pie.',
    selfTitle: (day: string) => `¿Fuiste al plan del ${day}?`,
    yes: 'Sí, fui',
    no: 'Al final no pude',
    thanks: 'Gracias. Tu palabra vale.',
  },

  safety: {
    report: 'Reportar',
    block: 'Bloquear',
    blocked: 'Ya no veréis vuestros planes.',
    reportTitle: '¿Qué ha pasado?',
    reportHelp: 'Lo lee una persona, no un algoritmo.',
    reportSubmit: 'Enviar',
    reportSent: 'Lo hemos recibido. Te decimos algo en cuanto lo miremos.',
    publicPlaces:
      'Quedamos siempre en sitios públicos. Si algo no te encaja, sal del plan sin dar explicaciones.',
    noDms: 'En Dorsal no se puede escribir a nadie por privado. El chat vive dentro del plan.',
    checkIn: '¿Todo bien?',
  },

  errors: {
    full: 'No queda plaza. Te avisamos si alguien se cae.',
    soloMujeres: 'Este plan es solo para mujeres.',
    needsMorePlans: (n: number) =>
      `Necesitas haber ido a ${n} planes para apuntarte a este. Empieza por uno abierto.`,
    levelMismatch: 'Este plan es de otro nivel. Busca uno que encaje con el tuyo.',
    hostCannotJoin: 'Este plan lo organizas tú.',
    planClosed: 'Este plan ya no admite gente.',
    planStarted: 'Este plan ya ha empezado.',
    blocked: 'No puedes apuntarte a este plan.',
    removedByHost: 'Quien organiza te ha sacado de este plan.',
    suspended: 'Tu cuenta está suspendida. Escríbenos si crees que es un error.',
    noProfile: 'Termina de darte de alta para apuntarte a un plan.',
    notAuthenticated: 'Entra en tu cuenta para seguir.',
    save: 'No hemos podido guardarlo. Vuelve a intentarlo.',
    load: 'No hemos podido cargar esto. Vuelve a intentarlo.',
    notFound: 'Esto ya no existe.',
    generic: 'Algo ha ido mal. Vuelve a intentarlo.',
  },

  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    back: 'Atrás',
    of: 'de',
  },
} as const;

/**
 * `Después: café en Malasaña`, or just `Después: café` when there is no venue.
 *
 * Venue names in this domain often already carry the noun — "Café en
 * Malasaña", "Bar en Lavapiés" — and naively gluing the label in front gives
 * "café en Café en Malasaña". When the venue name already starts with the
 * label's noun, the venue name speaks for itself.
 */
export function formatThirdHalf(
  thirdHalf: keyof typeof copy.plan.thirdHalf,
  venueName: string | null,
): string {
  const label = copy.plan.thirdHalf[thirdHalf];
  if (thirdHalf === 'ninguno' || !venueName) return label;

  const noun = label.replace(/^Después:\s*/, '').trim().toLowerCase();
  const startsWithNoun = venueName
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .startsWith(noun.normalize('NFD').replace(/\p{Diacritic}/gu, ''));

  return startsWithNoun ? `Después: ${venueName}` : copy.plan.thirdHalfAt(label, venueName);
}

/**
 * Maps the error codes raised by join_plan() onto copy. The database is the
 * single decision point for who may join, so this is the single place its
 * verdicts are put into words.
 */
export function joinErrorMessage(code: string, minPlans = 0): string {
  switch (code) {
    case 'solo_mujeres':      return copy.errors.soloMujeres;
    case 'needs_more_plans':  return copy.errors.needsMorePlans(minPlans);
    case 'level_mismatch':    return copy.errors.levelMismatch;
    case 'host_cannot_join':  return copy.errors.hostCannotJoin;
    case 'plan_closed':       return copy.errors.planClosed;
    case 'plan_started':      return copy.errors.planStarted;
    case 'blocked':           return copy.errors.blocked;
    case 'removed_by_host':   return copy.errors.removedByHost;
    case 'suspended':         return copy.errors.suspended;
    case 'no_profile':        return copy.errors.noProfile;
    case 'not_authenticated': return copy.errors.notAuthenticated;
    default:                  return copy.errors.generic;
  }
}
