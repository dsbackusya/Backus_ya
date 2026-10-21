/* Restaura la sesión al abrir la app. Se carga al final, cuando ya existen todas las pantallas */
(function(){
  var saved=loadSession();
  // El loader screen fue removido del DOM; backToLogin solo muestra login directamente.
  function backToLogin(){
    var lg=document.getElementById('s-login');
    if(lg){lg.classList.add('active');}
  }
  if(!saved||!saved.token){backToLogin();return;}
  // Verificar que el token sigue válido en el servidor
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||r.expired||!r.ok){
        clearSession();
        backToLogin();
        return;
      }
      S=saved;
      showLoadingAndInit(true);
    })
    .withFailureHandler(function(){
      // Sin red al abrir la app: se conserva la sesión (los conteos pendientes siguen en cola)
      S=saved;
      showLoadingAndInit(true);
    })
    .pingSession(saved.token);
})();
