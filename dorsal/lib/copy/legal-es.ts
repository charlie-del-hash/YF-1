/**
 * The legal pages, in Spanish, in the same voice as the rest of the app.
 *
 * TWO THINGS BEFORE THESE GO ANYWHERE NEAR A REAL SIGNUP:
 *
 * 1. The bracketed placeholders are the operator's identifying details, which
 *    LSSI-CE Art. 10 requires and which nobody but the operator knows. They are
 *    left visible on purpose — a plausible-looking invented NIF would be worse
 *    than an obvious gap.
 * 2. 05-RGPD is explicit that a Spanish abogado or a data-protection consultant
 *    has to review these. They are drafted from the decisions actually made in
 *    the code, which is the useful half of the job, and they are not advice.
 */
export interface LegalPage {
  slug: 'aviso' | 'privacidad' | 'cookies' | 'condiciones';
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

const UPDATED = '3 de septiembre de 2026';

export const LEGAL_PAGES: Record<LegalPage['slug'], LegalPage> = {
  aviso: {
    slug: 'aviso',
    title: 'Aviso legal',
    updated: UPDATED,
    sections: [
      {
        heading: 'Quién está detrás de Dorsal',
        body: [
          'Responsable: [NOMBRE O RAZÓN SOCIAL].',
          'NIF/CIF: [NIF].',
          'Domicilio: [DIRECCIÓN].',
          'Correo de contacto: [CORREO].',
          'Datos registrales: [REGISTRO MERCANTIL, TOMO, FOLIO, HOJA] (solo si se opera como sociedad).',
        ],
      },
      {
        heading: 'Qué es este servicio',
        body: [
          'Dorsal es una aplicación web que permite crear y unirse a quedadas deportivas en Madrid. No organiza las quedadas, no las supervisa y no está presente en ellas: quien crea un plan es quien lo organiza.',
          'Participar en una actividad física conlleva riesgos. Cada persona participa bajo su propia responsabilidad y debe valorar si su estado de salud se lo permite.',
        ],
      },
      {
        heading: 'Punto de contacto',
        body: [
          'Para cualquier comunicación, incluidas las de autoridades y las relativas a contenidos ilícitos: [CORREO]. Es también el punto único de contacto a efectos del Reglamento de Servicios Digitales.',
        ],
      },
    ],
  },

  privacidad: {
    slug: 'privacidad',
    title: 'Política de privacidad',
    updated: UPDATED,
    sections: [
      {
        heading: 'Qué guardamos, y qué no',
        body: [
          'Guardamos: tu correo, tu nombre, tu año de nacimiento, tu distrito, hasta dónde te desplazas, tus deportes y tu nivel, los planes a los que te apuntas, los mensajes que escribes en el chat de un plan y si apareciste o no.',
          'No guardamos tu dirección, ni tu ubicación exacta, ni te seguimos por el mapa. Tienes un distrito, no unas coordenadas. Guardamos el año de nacimiento, no la fecha.',
          'El género es opcional. Solo sirve para los planes solo para mujeres y no aparece en tu perfil público.',
        ],
      },
      {
        heading: 'Por qué podemos hacerlo',
        body: [
          'Para darte el servicio (perfil, planes, chat): porque tenemos un contrato contigo, el de estas condiciones.',
          'Para la seguridad, la moderación y el historial de asistencia: por interés legítimo en que esto sea un sitio al que se pueda ir sin miedo. Hemos escrito la ponderación y podemos enseñártela.',
          'Para las notificaciones que no sean imprescindibles: con tu consentimiento, y puedes retirarlo cuando quieras.',
        ],
      },
      {
        heading: 'Verificación con selfie',
        body: [
          'Si te verificas, una persona mira tu selfie, la compara con tu foto de perfil y la borra. No usamos reconocimiento facial ni ningún sistema automático de comparación: no tratamos datos biométricos.',
          'De la revisión solo queda la insignia. La foto se borra en cuanto alguien decide.',
        ],
      },
      {
        heading: 'Quién más lo ve',
        body: [
          'Supabase (base de datos, cuentas y almacenamiento), en la Unión Europea. Vercel (alojamiento de la aplicación), con las funciones fijadas a una región de la Unión Europea.',
          'Con ambos tenemos contrato de encargado de tratamiento. Son sociedades con matriz en Estados Unidos: las transferencias, si las hubiera, se amparan en las cláusulas contractuales tipo y en el marco de adecuación vigente.',
          'No vendemos tus datos. No hay publicidad. No hay perfilado con efectos jurídicos.',
        ],
      },
      {
        heading: 'Los avisos, si los activas',
        body: [
          'Para mandarte un aviso al móvil hace falta pasar por el servicio de notificaciones de tu propio navegador: Google si usas Chrome o Android, Mozilla si usas Firefox, Apple si usas Safari. No lo elegimos nosotros, lo elige tu navegador.',
          'Ese servicio recibe una dirección que apunta a tu navegador y unos bytes cifrados que no puede leer: el texto del aviso va cifrado con una clave que solo tiene tu dispositivo. No sabe quién eres, ni a qué plan te has apuntado, ni qué dice el mensaje.',
          'Guardamos esa dirección y dos claves, nada más: ni el modelo del móvil, ni desde dónde te conectas. Si quitas los avisos, la borramos en el momento. Es tu decisión y está apagada por defecto.',
        ],
      },
      {
        heading: 'Cuánto tiempo',
        body: [
          'Mientras tengas la cuenta. Si la borras, se borra tu perfil, tus deportes, tu historial de asistencia y tus reportes.',
          'Los mensajes que escribiste en un chat se quedan sin tu nombre. Lo hacemos así porque quitarlos dejaría al resto del grupo sin poder seguir lo que se acordó, y porque son parte de una conversación de varias personas.',
          'Los planes que organizabas se cancelan y se avisa a quien se había apuntado.',
        ],
      },
      {
        heading: 'Tus derechos',
        body: [
          'Puedes descargar todos tus datos y borrar tu cuenta desde la propia aplicación, en «Tu cuenta». No hace falta que escribas a nadie.',
          'También puedes corregir lo que esté mal, oponerte a un tratamiento basado en interés legítimo y pedir que lo limitemos.',
          'Si crees que lo hemos hecho mal, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).',
        ],
      },
      {
        heading: 'Menores',
        body: [
          'Dorsal es para mayores de 18 años. No es una cuestión de protección de datos —la ley española permite el consentimiento desde los 14— sino de que esto pone a desconocidos a quedar en un parque.',
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    title: 'Cookies',
    updated: UPDATED,
    sections: [
      {
        heading: 'No te vamos a pedir permiso, y este es el motivo',
        body: [
          'Dorsal no usa cookies de publicidad, ni de analítica, ni de terceros. Por eso no verás un banner: no hay nada que consentir.',
          'Lo que guardamos en tu navegador es lo imprescindible para que funcione: la cookie de sesión que te mantiene dentro; dos preferencias tuyas —si prefieres los planes en fichas o en lista, y si ya te hemos ofrecido instalar la app— que solo se guardan porque tú las eliges; y una copia del logo, de los tipos de letra y de la pantalla de «sin conexión», para que la aplicación abra en el metro.',
          'Todo ello está exento de consentimiento: o es estrictamente necesario, o responde a una elección explícita tuya. Nada de eso se envía a ninguna parte ni sirve para seguirte.',
          'Si activas los avisos, tu navegador guarda además la suscripción que los hace posibles. Se explica en la política de privacidad, y se borra en cuanto los desactivas.',
        ],
      },
      {
        heading: 'Si esto cambia',
        body: [
          'El día que añadamos analítica o cualquier otra cosa que no sea imprescindible, habrá un aviso donde rechazar cueste exactamente lo mismo que aceptar: mismo sitio, mismo tamaño, ningún laberinto de preferencias.',
        ],
      },
    ],
  },

  condiciones: {
    slug: 'condiciones',
    title: 'Condiciones de uso',
    updated: UPDATED,
    sections: [
      {
        heading: 'Las reglas, que son cuatro',
        body: [
          'Ve a lo que digas que vas a ir. Y si no puedes, avisa cuanto antes: otra persona ocupará tu plaza. Avisar con tiempo no cuenta como falta; desaparecer, sí.',
          'Se queda en sitios públicos. Un parque, una pista, la puerta de un polideportivo. Nunca un portal ni una casa.',
          'Nadie usa esto para ligar. Aquí no se puede escribir a nadie por privado y el chat vive dentro del plan. Si alguien lo intenta, repórtalo.',
          'Di tu nivel de verdad. Apuntarte a un plan que te viene grande estropea el plan a otras siete personas.',
        ],
      },
      {
        heading: 'Qué pasa si no',
        body: [
          'Dos faltas en un mes y durante unos días no podrás apuntarte a los planes que estén casi llenos. Los demás siguen abiertos: es una pausa, no una expulsión.',
          'El acoso, las amenazas y los perfiles falsos son otra cosa. Eso lo mira una persona y puede terminar en la suspensión de la cuenta.',
        ],
      },
      {
        heading: 'Quién responde de qué',
        body: [
          'Dorsal pone en contacto a la gente; no organiza las quedadas ni está en ellas. Quien crea un plan es quien lo organiza, y participar es responsabilidad de cada cual.',
          'Comprueba que tu estado de salud te permite hacer la actividad, y que el sitio donde quedáis admite lo que vais a hacer: algunos parques e instalaciones municipales de Madrid exigen autorización para actividades organizadas.',
          'Si pasa algo grave en un plan, llama al 112. Después cuéntanoslo: cooperaremos con quien haga falta.',
        ],
      },
      {
        heading: 'Edad',
        body: ['Para usar Dorsal hay que tener 18 años cumplidos.'],
      },
    ],
  },
};
