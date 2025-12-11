(function($){
// Generic helpers for modals
window.VMSModal = {
el: null,
open(title, bodyHtml, footerHtml){
if (!this.el) this.el = document.getElementById('vms-modal');
if (!this.el) return;
this.el.querySelector('#vms-modal-title').textContent = title || '';
this.el.querySelector('#vms-modal-body').innerHTML = bodyHtml || '';
this.el.querySelector('#vms-modal-footer').innerHTML = footerHtml || '';
this.el.hidden = false;
this.el.querySelector('.vms-modal__close').onclick = ()=> this.close();
},
close(){ if (this.el) this.el.hidden = true; }
};
})(jQuery);