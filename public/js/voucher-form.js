(function () {
  function syncFaceValue() {
    const orderTotal = document.getElementById('orderTotalInput')
    const faceValue = document.getElementById('faceValueInput')
    if (!orderTotal || !faceValue) return
    orderTotal.addEventListener('input', () => {
      if (orderTotal.value !== '') faceValue.value = orderTotal.value
    })
  }

  function addProductRow(repeater) {
    const div = document.createElement('div')
    div.className = 'row g-2 align-items-end product-row mb-2'
    div.innerHTML = `
      <div class="col-md-5">
        <label class="form-label">Product Name</label>
        <input class="form-control" name="product_name[]" placeholder="Name">
      </div>
      <div class="col-md-3">
        <label class="form-label">Product ID / SKU</label>
        <input class="form-control" name="product_id[]" placeholder="Optional ID">
      </div>
      <div class="col-md-3">
        <label class="form-label">Price</label>
        <input class="form-control" name="product_price[]" type="number" step="0.01">
      </div>
      <div class="col-md-1 text-end">
        <button type="button" class="btn btn-outline-danger btn-remove-row">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`
    repeater.appendChild(div)
    bindRemoveButtons(repeater)
  }

  function bindRemoveButtons(repeater) {
    const rows = repeater.querySelectorAll('.product-row')
    repeater.querySelectorAll('.btn-remove-row').forEach((btn) => {
      btn.onclick = () => {
        const currentRows = repeater.querySelectorAll('.product-row')
        if (currentRows.length === 1) {
          currentRows[0].querySelectorAll('input').forEach((input) => {
            input.value = ''
          })
          return
        }
        btn.closest('.product-row')?.remove()
      }
    })
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncFaceValue()
    const repeater = document.getElementById('products-repeater')
    const addBtn = document.getElementById('add-product-row')
    if (!repeater || !addBtn) return
    bindRemoveButtons(repeater)
    addBtn.addEventListener('click', () => addProductRow(repeater))
  })
})()
