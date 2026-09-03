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
    outOfBand: 'Fuera de tu nivel',
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
      timeOfDayLabel: 'Hora',
      timeOfDay: { any: 'A cualquier hora', manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' },
      levelOptions: { mine: 'Mi nivel', all: 'Todos los niveles' },
      active: (n: number) => (n === 1 ? '1 filtro' : `${n} filtros`),
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
    cancelled: 'Plan cancelado',
    cancelledBecause: (reason: string) => `Cancelado: ${reason}`,
    leftWaitlist: 'Has dejado la lista de espera.',
    promoted: 'Se ha caído alguien y tienes plaza.',
    edit: 'Editar el plan',
    cancelPlan: 'Cancelar el plan',
    cancelTitle: '¿Por qué se cancela?',
    cancelHelp: 'Lo verá la gente que se había apuntado. Sé concreto.',
    cancelReasonLabel: 'Motivo',
    cancelReasonPlaceholder: 'Aviso de lluvia, no hay pista…',
    cancelConfirm: 'Cancelar el plan',
    cancelKeep: 'Dejarlo como está',
    cancelDone: 'Plan cancelado. Avisa también por el chat cuando esté.',
    notifyPending: 'Todavía no mandamos avisos automáticos. Díselo tú al grupo.',
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
    gate: (n: number) => `Para gente con ${n} ${n === 1 ? 'plan' : 'planes'} o más`,
    reservedPlaza: 'Una plaza guardada para alguien que empieza.',
  },

  create: {
    title: 'Crear un plan',
    editTitle: 'Editar el plan',
    sport: '¿Qué deporte?',
    when: '¿Cuándo?',
    dateLabel: 'Día',
    timeLabel: 'Hora',
    durationLabel: 'Cuánto dura',
    durationValue: (min: number) => `${min} min`,
    where: '¿Dónde quedáis?',
    venueLabel: 'Punto de encuentro',
    venuePick: 'Elegir de la lista',
    venuePin: 'Marcarlo en el mapa',
    venuePinHelp:
      'Marca solo sitios públicos: un parque, una pista municipal, la puerta de un polideportivo. Nunca un portal ni una casa.',
    venuePinName: 'Cómo se llama el sitio',
    venuePinPlaceholder: 'Puerta del rocódromo, fuente del parque…',
    venuePinDistrito: 'Distrito',
    venuePinSave: 'Usar este sitio',
    venuePinUnverified: 'Lo revisaremos antes de darlo por bueno.',
    level: '¿Para qué nivel?',
    levelFrom: 'Desde',
    levelTo: 'Hasta',
    capacity: '¿Cuántas plazas?',
    capacityHelp: 'Contándote a ti, sois uno más.',
    gateLabel: '¿Pides experiencia?',
    gateHelp:
      'Como mucho dos planes. Más que eso y quien acaba de llegar no puede empezar por ningún sitio.',
    gateOptions: {
      none: 'Cualquiera puede apuntarse',
      one: 'Con un plan a la espalda',
      two: 'Con dos planes a la espalda',
    },
    thirdHalfLabel: '¿Y después?',
    thirdHalfVenueLabel: '¿Dónde quedáis después?',
    audienceLabel: 'Quién puede apuntarse',
    audienceAll: 'Cualquiera',
    audienceWomen: 'Solo mujeres',
    audienceWomenHelp: 'No aparecerá en los planes de nadie más.',
    noteLabel: 'Algo que deban saber',
    notePlaceholder: 'Salimos puntuales. Traigo petos.',
    submit: 'Crear el plan',
    save: 'Guardar los cambios',
    saving: 'Guardando…',
    created: 'Plan creado. Ya se puede apuntar la gente.',
    saved: 'Guardado.',
    errors: {
      sport: 'Elige un deporte.',
      past: 'Elige una hora que aún no haya pasado.',
      venue: 'Elige un punto de encuentro.',
      venueName: 'Ponle un nombre al sitio.',
      capacity: 'Las plazas van de 2 a 40.',
      levelOrder: 'El nivel mínimo no puede ser mayor que el máximo.',
      notHost: 'Este plan no es tuyo.',
      capacityBelowJoined: 'Ya hay más gente apuntada que plazas. Sube las plazas o saca a alguien.',
      cancelReason: 'Escribe un motivo. Lo verá la gente que se había apuntado.',
      audienceWomen: 'Los planes solo para mujeres los crea quien se ha declarado mujer en su perfil.',
    },
  },

  myPlans: {
    title: 'Mis planes',
    upcoming: 'Próximos',
    past: 'Pasados',
    hosting: 'Lo organizas tú',
    waitlisted: 'En lista de espera',
    emptyUpcoming: 'No tienes ningún plan a la vista. Busca uno o crea el tuyo.',
    emptyPast: 'Aquí aparecerán los planes a los que hayas ido.',
    findPlans: 'Ver planes',
  },

  profile: {
    dorsalNumber: 'Dorsal',
    plansAttended: (n: number) => (n === 1 ? '1 plan' : `${n} planes`),
    attendance: (pct: number) => `${pct}% asistencia`,
    newcomer: 'Nuevo por aquí',
    noPlansYet: 'Todavía sin planes',
    palabra: (plans: string, pct: number) => `${plans} · ${pct}% asistencia`,
    sports: 'Deportes',
    zone: 'Zona',
    travel: (km: number) => `Hasta ${km} km`,
    edit: 'Editar mi dorsal',
    verified: 'Verificado',
  },

  chat: {
    title: 'Chat del plan',
    open: 'Abrir el chat',
    placeholder: 'Escribe al grupo',
    send: 'Enviar',
    sending: 'Enviando…',
    onlyThisPlan: 'Solo puedes escribir con la gente de este plan.',
    closesAfter: 'Este chat se cierra 48 h después del plan.',
    closed: 'Este chat ya está cerrado. Puedes leerlo, pero no escribir.',
    pin: 'Fijar mensaje',
    unpin: 'Quitar el fijado',
    pinned: 'Fijado',
    delete: 'Borrar',
    you: 'Tú',
    deletedAuthor: 'Cuenta eliminada',
    unread: (n: number) => (n === 1 ? '1 mensaje sin leer' : `${n} mensajes sin leer`),
    emptyTitle: 'Todavía no ha escrito nadie.',
    emptyBody: 'Di por dónde entras o a qué hora llegas. Ayuda más de lo que parece.',
    emptyHost: 'Escribe el punto exacto y fíjalo. Es lo que evita las llamadas de última hora.',
    sendFailed: 'No se ha enviado. Vuelve a intentarlo.',
    tooLong: 'Te has pasado de largo. Máximo 1000 caracteres.',
  },

  attendance: {
    hostTitle: '¿Quién vino?',
    hostHelp: 'Marca a quien apareció. Tarda diez segundos y es lo que mantiene esto en pie.',
    selfTitle: (day: string) => `¿Fuiste al plan del ${day}?`,
    yes: 'Sí, fui',
    no: 'Al final no pude',
    came: 'Vino',
    didNotCome: 'No vino',
    thanks: 'Gracias. Tu palabra vale.',
    pending: 'Falta confirmar',
    windowCloses: 'Tienes 72 h para decirlo. Después vale lo que diga la otra parte.',
    disputed: 'No coincidís en esto. No cuenta para nadie.',
    settled: 'Ya está anotado.',
    saveFailed: 'No se ha podido anotar. Vuelve a intentarlo.',
  },

  safety: {
    menu: 'Opciones',
    report: 'Reportar',
    block: 'Bloquear',
    blocked: 'Ya no veréis vuestros planes.',
    blockConfirm: (name: string) => `¿Bloquear a ${name}?`,
    blockExplain: 'Dejaréis de veros en planes, listas y chats. No se le avisa de nada.',
    blockSharedPlans: (n: number) =>
      n === 1
        ? 'Compartís un plan que aún no ha pasado.'
        : `Compartís ${n} planes que aún no han pasado.`,
    blockLeaveShared: 'Salirme de esos planes',
    blockLeaveFree: 'Salir por este motivo no cuenta como falta.',
    blockStay: 'Me quedo en los planes',
    reportTitle: '¿Qué ha pasado?',
    reportHelp: 'Lo lee una persona, no un algoritmo.',
    reportDetail: 'Cuéntanoslo',
    reportDetailPlaceholder: 'Lo que creas que debemos saber.',
    reportSubmit: 'Reportar',
    reportSent: 'Lo hemos recibido. Te decimos algo en cuanto lo miremos.',
    reportReasons: {
      acoso: 'Acoso o mensajes fuera de lugar',
      peligro: 'Me he sentido en peligro',
      no_aparecio: 'No apareció',
      perfil_falso: 'El perfil no es quien dice ser',
      spam: 'Spam o publicidad',
      otro: 'Otra cosa',
    },
    publicPlaces:
      'Quedamos siempre en sitios públicos. Si algo no te encaja, sal del plan sin dar explicaciones.',
    noDms: 'En Dorsal no se puede escribir a nadie por privado. El chat vive dentro del plan.',
    checkIn: '¿Todo bien?',
    checkInHelp: 'Es privado. No lo ve quien organiza ni nadie del plan.',
    checkInYes: 'Todo bien',
    checkInNo: 'No del todo',
    checkInNote: '¿Qué ha pasado?',
    checkInThanks: 'Gracias por decirlo. Lo lee una persona.',
    myReports: 'Lo que has reportado',
    reportStatus: {
      open: 'Recibido',
      reviewing: 'Lo estamos mirando',
      actioned: 'Hemos actuado',
      dismissed: 'Lo hemos mirado y no hemos actuado',
    },
    deletedAccount: 'Cuenta eliminada',
  },

  verification: {
    title: 'Verifica tu dorsal',
    help: 'Hazte una foto ahora mismo. La mira una persona, la compara con tu foto de perfil y la borra.',
    manualNote: 'No usamos reconocimiento facial. Lo revisa una persona.',
    take: 'Hacerme la foto',
    submit: 'Mandarla a revisar',
    pending: 'En revisión. Te avisamos.',
    approved: 'Verificado',
    rejected: 'No hemos podido verificarlo.',
    retry: 'Probar otra vez',
    badge: 'Dorsal verificado',
    failed: 'No se ha podido subir la foto. Vuelve a intentarlo.',
  },

  account: {
    title: 'Tu cuenta',
    exportTitle: 'Descargar mis datos',
    exportHelp: 'Todo lo que guardamos sobre ti, en un archivo.',
    exportButton: 'Descargar',
    exportPreparing: 'Preparando…',
    deleteTitle: 'Borrar mi cuenta',
    deleteHelp:
      'Se borra tu perfil, tus deportes, tu historial de asistencia y tus reportes. Los mensajes que escribiste se quedan en los chats sin tu nombre, para que el resto del grupo pueda seguir el hilo. Los planes que organizabas se cancelan.',
    deleteConfirmLabel: 'Escribe BORRAR para confirmar',
    deleteConfirmWord: 'BORRAR',
    deleteButton: 'Borrar mi cuenta',
    deleteFailed: 'No hemos podido borrar la cuenta. Vuelve a intentarlo.',
    deleting: 'Borrando…',
  },

  admin: {
    title: 'Moderación',
    reports: 'Reportes',
    verifications: 'Verificaciones',
    empty: 'No hay nada pendiente.',
    reasonLabel: 'Motivo de la decisión',
    reasonPlaceholder: 'Queda registrado con tu nombre.',
    suspend: 'Suspender cuenta',
    unsuspend: 'Levantar la suspensión',
    removePlan: 'Retirar el plan',
    approve: 'Aprobar',
    reject: 'Rechazar',
    dismiss: 'Sin acción',
    action: 'Actuar',
    reportedBy: (name: string) => `Lo reporta ${name}`,
    about: 'Sobre',
    notAdmin: 'Esta parte no es para ti.',
  },

  legal: {
    title: 'Legal',
    aviso: 'Aviso legal',
    privacidad: 'Política de privacidad',
    cookies: 'Cookies',
    condiciones: 'Condiciones de uso',
    draftWarning:
      'Borrador. Antes de aceptar registros reales tiene que revisarlo un abogado o una consultora de protección de datos.',
  },

  errors: {
    full: 'No queda plaza. Te avisamos si alguien se cae.',
    soloMujeres: 'Este plan es solo para mujeres.',
    needsMorePlans: (n: number) =>
      `Necesitas haber ido a ${n} ${n === 1 ? 'plan' : 'planes'} para apuntarte a este. ` +
      'Empieza por uno abierto.',
    levelMismatch: 'Este plan es de otro nivel. Busca uno que encaje con el tuyo.',
    hostCannotJoin: 'Este plan lo organizas tú.',
    planClosed: 'Este plan ya no admite gente.',
    planStarted: 'Este plan ya ha empezado.',
    blocked: 'No puedes apuntarte a este plan.',
    removedByHost: 'Quien organiza te ha sacado de este plan.',
    cooldown:
      'Has faltado a dos planes este mes. Los que están casi llenos se te cierran unos días; el resto siguen abiertos.',
    suspended: 'Tu cuenta está suspendida. Escríbenos si crees que es un error.',
    noProfile: 'Termina de darte de alta para apuntarte a un plan.',
    notAuthenticated: 'Entra en tu cuenta para seguir.',
    save: 'No hemos podido guardarlo. Vuelve a intentarlo.',
    load: 'No hemos podido cargar esto. Vuelve a intentarlo.',
    network: 'No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.',
    notFound: 'Esto ya no existe.',
    hostCannotLeave: 'Organizas este plan. Si no puedes ir, cancélalo con un motivo.',
    notJoined: 'No estabas apuntado a este plan.',
    generic: 'Algo ha ido mal. Vuelve a intentarlo.',
  },

  boundary: {
    notFoundTitle: 'Esto no existe',
    notFoundBody: 'El plan se ha cancelado, o el enlace está mal. Vuelve a los planes.',
    errorTitle: 'Se nos ha roto algo',
    errorBody: 'No es culpa tuya. Vuelve a intentarlo y, si sigue igual, dínoslo.',
    backToDeck: 'Ver planes',
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
