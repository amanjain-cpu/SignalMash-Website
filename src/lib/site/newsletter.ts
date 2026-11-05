/**
 * The footer's "Stay Updated" newsletter form, on 322 pages.
 *
 * On Webflow, webflow.js posts it to Webflow's form service, which emails each sign-up to the
 * address set in Site settings → Forms. That service goes away with the Webflow plan, so this
 * script takes the form over: it listens in the capture phase, ahead of webflow.js, and sends the
 * address to NEWSLETTER_FORM_ACTION instead (a Zoho Forms submit URL; see README.md).
 *
 * The page keeps Webflow's markup and behaviour: the button shows its "Please wait..." text while
 * sending, then the form is replaced by the existing success message, or the existing error
 * message is shown. Every other form on the site (the Zoho embeds, the blog filters) is untouched.
 */
export function newsletterScript(): string {
  const config = {
    action: process.env.NEWSLETTER_FORM_ACTION ?? "",
    field: process.env.NEWSLETTER_EMAIL_FIELD ?? "Email",
  };
  return `(function(){var C=${JSON.stringify(config).replaceAll("<", "\\u003c")};
document.addEventListener("submit",function(e){
  var form=e.target;
  if(!form||form.getAttribute("data-name")!=="Email Form")return;
  e.preventDefault();e.stopImmediatePropagation();
  var wrap=form.parentElement,done=wrap&&wrap.querySelector(".w-form-done"),fail=wrap&&wrap.querySelector(".w-form-fail");
  var email=form.querySelector('input[type="email"]'),button=form.querySelector('[type="submit"]');
  var label=button&&button.value;
  if(fail)fail.style.display="none";
  function finish(ok){
    if(button){button.value=label;button.disabled=false;}
    if(ok){form.style.display="none";if(done)done.style.display="block";}
    else if(fail){fail.style.display="block";}
  }
  if(!C.action){console.warn("Newsletter form: NEWSLETTER_FORM_ACTION is not set, nothing was sent.");finish(false);return;}
  if(button){button.value=button.getAttribute("data-wait")||label;button.disabled=true;}
  var body=new FormData();body.append(C.field,email?email.value:"");
  fetch(C.action,{method:"POST",mode:"no-cors",body:body}).then(function(){finish(true)},function(){finish(false)});
},true);})();`;
}
