// imports
importScripts('https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js')

importScripts('js/sw-db.js');
importScripts('js/sw-utils.js');


const STATIC_CACHE    = 'static-v2';
const DYNAMIC_CACHE   = 'dynamic-v1';
const INMUTABLE_CACHE = 'inmutable-v1';


const APP_SHELL = [
    '/',
    'index.html',
    'css/style.css',
    'img/favicon.ico',
    'img/avatars/hulk.jpg',
    'img/avatars/ironman.jpg',
    'img/avatars/spiderman.jpg',
    'img/avatars/thor.jpg',
    'img/avatars/wolverine.jpg',
    'js/app.js',
    'js/sw-utils.js',
    'js/libs/plugins/mdtoast.min.js',
    'js/libs/plugins/mdtoast.min.css'
];

const APP_SHELL_INMUTABLE = [
    'https://fonts.googleapis.com/css?family=Quicksand:300,400',
    'https://fonts.googleapis.com/css?family=Lato:400,300',
    //'https://use.fontawesome.com/releases/v5.3.1/css/all.css',
    'https://cdnjs.cloudflare.com/ajax/libs/animate.css/3.7.0/animate.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js',
    'https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js'
];



self.addEventListener('install', e => {


    const cacheStatic = caches.open( STATIC_CACHE ).then(cache => 
        cache.addAll( APP_SHELL ));

    const cacheInmutable = caches.open( INMUTABLE_CACHE ).then(cache => 
        cache.addAll( APP_SHELL_INMUTABLE ));



    e.waitUntil( Promise.all([ cacheStatic, cacheInmutable ])  );

});


self.addEventListener('activate', e => {

    const respuesta = caches.keys().then( keys => {

        keys.forEach( key => {

            if (  key !== STATIC_CACHE && key.includes('static') ) {
                return caches.delete(key);
            }

            if (  key !== DYNAMIC_CACHE && key.includes('dynamic') ) {
                return caches.delete(key);
            }

        });

    });

    e.waitUntil( respuesta );

});





self.addEventListener( 'fetch', e => {

    let respuesta;

    if ( e.request.url.includes('/api') ) {

        // return respuesta????
        respuesta = manejoApiMensajes( DYNAMIC_CACHE, e.request );

    } else {

        respuesta = caches.match( e.request ).then( res => {

            if ( res ) {
                
                actualizaCacheStatico( STATIC_CACHE, e.request, APP_SHELL_INMUTABLE );
                return res;
                
            } else {
    
                return fetch( e.request ).then( newRes => {
    
                    return actualizaCacheDinamico( DYNAMIC_CACHE, e.request, newRes );
    
                });
    
            }
    
        });

    }

    e.respondWith( respuesta );

});


// tareas asíncronas
self.addEventListener('sync', e => {

    console.log('SW: Sync');

    if ( e.tag === 'nuevo-post' ) {

        // postear a BD cuando hay conexión
        const respuesta = postearMensajes();
        
        e.waitUntil( respuesta );
    }

});

// Escuchar PUSH
// public/sw.js
self.addEventListener('push', event => {
  let data = {
    titulo: 'Notificación por Defecto',
    cuerpo: 'Mensaje recibido',
    usuario: 'system'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.cuerpo = event.data.text();
    }
  }

  const title = data.titulo || 'Notificación Push UPTC';
  const options = {
    body: data.cuerpo || 'Tiene un nuevo mensaje en el chat.',
    icon: `img/avatars/${data.usuario || 'spiderman'}.jpg`,
    badge: 'img/favicon.ico',
    image: 'https://vignette.wikia.nocookie.net/marvelcinematicuniverse/images/5/5b/Torre_de_los_Avengers.png',
    vibrate: [200, 100, 200, 100, 400], // Patrón de vibración [pulso, pausa, pulso...]
    tag: 'chat-group-notification',     // Agrupador de notificaciones
    renotify: true,                      // Reemplaza y vuelve a alertar si comparte tag
    requireInteraction: true,           // Persiste hasta interacción del usuario
    data: {
      url: '/',
      fecha: new Date().toISOString(),
      usuarioId: data.usuario || 'spiderman'
    },
    actions: [
      { action: 'aceptar-action', title: 'Responder', icon: 'img/avatar/thor.jpg' },
      { action: 'cancelar-action', title: 'Descartar', icon: 'img/avatar/ironman.jpg' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listener para la interacción con los botones de acción
self.addEventListener('notificationclick', event => {
  const notificacion = event.notification;
  const accion = event.action;

  if (accion === 'aceptar-action') {
    console.log('El usuario seleccionó: Responder');
    clients.openWindow(notificacion.data.url);
  } else if (accion === 'cancelar-action') {
    console.log('El usuario seleccionó: Descartar');
  } else {
    console.log('El usuario hizo clic en el cuerpo de la notificación');
  }

  notificacion.close();
});


// Cierra la notificacion
self.addEventListener('notificationclose', e => {
    console.log('Notificación cerrada', e);
});


/* self.addEventListener('notificationclick', e => {


    const notificacion = e.notification;
    const accion = e.action;


    console.log({ notificacion, accion });
    // console.log(notificacion);
    // console.log(accion);
    

    const respuesta = clients.matchAll()
    .then( clientes => {

        let cliente = clientes.find( c => {
            return c.visibilityState === 'visible';
        });

        if ( cliente !== undefined ) {
            cliente.navigate( notificacion.data.url );
            cliente.focus();
        } else {
            clients.openWindow( notificacion.data.url );
        }

        return notificacion.close();

    });

    e.waitUntil( respuesta );


}); */

self.addEventListener('notificationclick', e => {
    const notificacion = e.notification;
    const url = notificacion.data && notificacion.data.url ? notificacion.data.url : '/';

    e.notification.close();

    const respuesta = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(clientes => {

        for (const cliente of clientes) {
            if ('focus' in cliente) {
                if (cliente.url.includes(url) || cliente.visibilityState === 'visible') {
                    return cliente.focus();
                }
            }
        }

        if (clients.openWindow) {
            return clients.openWindow(url);
        }
    });

    e.waitUntil(respuesta);
});