// ============================================
// OPENSTREETMAP — Fonctions globales
// ============================================

// TODO: Remplacer localStorage par Supabase plus tard

/**
 * Géolocaliser l'utilisateur via le navigateur puis reverse geocode via Nominatim
 * @param {Function} callback(lat, lng, address) — appelé avec les résultats
 * @param {Function} onError(msg) — appelé en cas d'erreur
 */
function osmGeolocate(callback, onError) {
  if (!navigator.geolocation) {
    if (onError) onError("La géolocalisation n'est pas supportée.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Reverse geocoding via Nominatim
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1', {
        headers: { 'Accept-Language': 'fr' }
      })
      .then(r => r.json())
      .then(data => {
        const address = data.display_name || lat.toFixed(5) + ', ' + lng.toFixed(5);
        localStorage.setItem('bide_user_location', JSON.stringify({ lat, lng, address, timestamp: Date.now() }));
        callback(lat, lng, address);
      })
      .catch(() => {
        const address = lat.toFixed(5) + ', ' + lng.toFixed(5);
        localStorage.setItem('bide_user_location', JSON.stringify({ lat, lng, address, timestamp: Date.now() }));
        callback(lat, lng, address);
      });
    },
    (err) => {
      let msg = "Impossible d'accéder à votre position.";
      if (err.code === 1) msg = "Vous avez refusé l'accès à la localisation.";
      else if (err.code === 2) msg = "Position indisponible. Réessayez.";
      if (onError) onError(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

/**
 * Rechercher une adresse via Nominatim
 * @param {string} query — texte à rechercher
 * @returns {Promise<Array>} — liste de résultats [{lat, lon, display_name}]
 */
async function osmSearch(query) {
  const resp = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=5&addressdetails=1', {
    headers: { 'Accept-Language': 'fr' }
  });
  return resp.json();
}

document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // 1. ESTIMATEUR ACCUEIL — Calculer
  // ============================================
  const estForm = document.getElementById('estimator-form');
  if (estForm) {
    // TODO: Remplacer par Supabase plus tard — Tarifs de base par service
    const tarifsBase = {
      lavage:     { citadine: 15000, suv: 18000, utilitaire: 22500 },
      pressing:   { citadine: 1500,  suv: 1500,  utilitaire: 1500  },
      entretien:  { citadine: 15000, suv: 15000, utilitaire: 15000 },
      menage:     { citadine: 10000, suv: 10000, utilitaire: 10000 }
    };
    const pages = { lavage: 'lavage.html', pressing: 'pressing.html', entretien: 'entretien.html', menage: 'menage.html' };
    const lieuMulti = { centre: 1, domicile: 1.3 };
    const vehiculeMulti = { citadine: 1, suv: 1.2, utilitaire: 1.5 };

    // Désactiver le champ Véhicule si Pressing ou Ménage sélectionné
    const estServiceEl = document.getElementById('est-service');
    const estVehicleEl = document.getElementById('est-vehicle');
    if (estServiceEl && estVehicleEl) {
      estServiceEl.addEventListener('change', () => {
        const val = estServiceEl.value;
        if (val === 'pressing' || val === 'menage') {
          estVehicleEl.disabled = true;
          estVehicleEl.value = 'citadine';
          estVehicleEl.classList.add('opacity-50');
        } else {
          estVehicleEl.disabled = false;
          estVehicleEl.classList.remove('opacity-50');
        }
      });
    }

    estForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const service = estServiceEl.value;
      const vehicle = estVehicleEl.disabled ? 'citadine' : estVehicleEl.value;
      const lieu = document.getElementById('est-location').value;
      const base = tarifsBase[service][vehicle] || 10000;
      const needsVehicle = (service !== 'pressing' && service !== 'menage');
      const total = Math.round(base * lieuMulti[lieu] * (needsVehicle ? vehiculeMulti[vehicle] : 1));
      document.getElementById('est-price').textContent = total.toLocaleString('fr-FR') + ' FCFA';
      let note = service.charAt(0).toUpperCase() + service.slice(1) + ' • ';
      note += (lieu === 'domicile' ? 'À domicile (+30%)' : 'Au centre');
      if (needsVehicle) note += ' • ' + vehicle.charAt(0).toUpperCase() + vehicle.slice(1);
      document.getElementById('est-note').textContent = note;
      document.getElementById('est-reserve-btn').href = pages[service] || 'entretien.html';
      document.getElementById('est-result').classList.remove('d-none');
    });
  }

  // ============================================
  // 2. LAVAGE AUTO — Scroll tarifs + Prix dynamiques
  // ============================================
  // Lien "Voir les tarifs" scroll smooth vers la section tarifs
  const btnVoirTarifs = document.getElementById('btn-voir-tarifs');
  if (btnVoirTarifs) {
    btnVoirTarifs.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(btnVoirTarifs.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Même chose pour menage.html
  const btnVoirTarifsMenage = document.querySelector('a[href="#menage-tarifs"]');
  if (btnVoirTarifsMenage) {
    btnVoirTarifsMenage.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('menage-tarifs');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Ajustement des prix lavage selon véhicule + lieu
  const vehicleRadios = document.querySelectorAll('input[name="vehicleType"]');
  const priceElements = document.querySelectorAll('.card-plan .h2');
  const basePrices = [15000, 25000, 45000, 80000];
  const locationSwitch = document.getElementById('locationSwitch');

  function updateLavagePrices() {
    let vehicleMultiplier = 1;
    const checkedVehicle = document.querySelector('input[name="vehicleType"]:checked');
    if (checkedVehicle) {
      if (checkedVehicle.id === 'suv') vehicleMultiplier = 1.2;
      if (checkedVehicle.id === 'utilitaire') vehicleMultiplier = 1.5;
    }
    let locationMultiplier = 1;
    if (locationSwitch && locationSwitch.checked) locationMultiplier = 1.3;

    priceElements.forEach((priceEl, index) => {
      if (index < basePrices.length) {
        const newPrice = Math.round(basePrices[index] * vehicleMultiplier * locationMultiplier);
        priceEl.textContent = newPrice.toLocaleString('fr-FR');
      }
    });
  }

  vehicleRadios.forEach(radio => {
    radio.addEventListener('change', updateLavagePrices);
  });
  if (locationSwitch) {
    locationSwitch.addEventListener('change', updateLavagePrices);
  }

  // ============================================
  // 3. PRESSING — Filtres catégories
  // ============================================
  const filterBtns = document.querySelectorAll('#pressing-filters .btn');
  const articleCards = document.querySelectorAll('.article-card');

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active state
        filterBtns.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-light', 'text-secondary'); });
        btn.classList.remove('btn-light', 'text-secondary');
        btn.classList.add('btn-primary');

        const filter = btn.getAttribute('data-filter');
        articleCards.forEach(card => {
          if (card.getAttribute('data-category') === filter) {
            card.classList.remove('d-none');
          } else {
            card.classList.add('d-none');
          }
        });
      });
    });
  }

  // ============================================
  // 3b. PRESSING — Panier dynamique
  // ============================================
  const cart = [];
  const cartBadge = document.getElementById('cart-badge');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');
  const submitBtn = document.getElementById('submit-btn');
  const addToCartBtns = document.querySelectorAll('.add-to-cart-btn');

  if (addToCartBtns.length > 0) {
    addToCartBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Ne pas déclencher si on est dans le handler global checkAuth
        if (btn.dataset.authClicked === 'true') {
          btn.dataset.authClicked = '';
          return;
        }
        const name = btn.getAttribute('data-name');
        const price = parseInt(btn.getAttribute('data-price'));
        const existingItem = cart.find(item => item.name === name);
        if (existingItem) { existingItem.qty += 1; }
        else { cart.push({ name, price, qty: 1 }); }
        updateCartUI();
        btn.style.transform = 'scale(0.85)';
        setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
      });
    });

    function updateCartUI() {
      const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      if (cartBadge) cartBadge.textContent = totalItems + ' article' + (totalItems > 1 ? 's' : '');
      if (cartItemsContainer) {
        if (cart.length === 0) {
          cartItemsContainer.innerHTML = '<i class="fa-solid fa-shirt text-muted fs-3 mb-2 opacity-50"></i><p class="text-muted extra-small mb-0">Selectionnez des articles pour commencer</p>';
          cartItemsContainer.classList.add('py-4', 'border-top', 'border-bottom', 'text-center');
          if (submitBtn) submitBtn.disabled = true;
        } else {
          cartItemsContainer.innerHTML = cart.map((item, idx) => '<div class="d-flex justify-content-between align-items-center py-2 border-bottom"><div><strong class="small">' + item.name + '</strong><span class="d-block extra-small text-muted">' + item.price.toLocaleString('fr-FR') + ' FCFA x ' + item.qty + '</span></div><div class="d-flex align-items-center gap-2"><span class="fw-bold small">' + (item.price * item.qty).toLocaleString('fr-FR') + ' FCFA</span><button class="remove-item btn btn-sm p-0 text-danger" data-idx="' + idx + '" title="Retirer"><i class="fa-solid fa-xmark"></i></button></div></div>').join('');
          cartItemsContainer.classList.remove('py-4', 'border-top', 'border-bottom', 'text-center');
          if (submitBtn) submitBtn.disabled = false;
          cartItemsContainer.querySelectorAll('.remove-item').forEach(rbtn => {
            rbtn.addEventListener('click', () => {
              const idx = parseInt(rbtn.getAttribute('data-idx'));
              if (cart[idx].qty > 1) { cart[idx].qty -= 1; }
              else { cart.splice(idx, 1); }
              updateCartUI();
            });
          });
        }
      }
      if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' FCFA';
      if (totalEl) totalEl.textContent = subtotal.toLocaleString('fr-FR') + ' FCFA';
    }

    // Bouton "Planifier le ramassage" → vérifie l'auth puis ouvre le modal de paiement pressing
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (cart.length === 0) return;
        // Vérifier l'authentification avant d'ouvrir le paiement
        checkAuthAndAction(() => {
        // Remplir le résumé dans le modal
        const summaryEl = document.getElementById('press-order-summary');
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        if (summaryEl) {
          summaryEl.innerHTML = cart.map(item => '<div class="d-flex justify-content-between align-items-center py-2 border-bottom"><div><strong class="small">' + item.name + '</strong><span class="d-block extra-small text-muted">x' + item.qty + '</span></div><span class="fw-bold small">' + (item.price * item.qty).toLocaleString('fr-FR') + ' FCFA</span></div>').join('');
        }
        const sumSubtotalEl = document.getElementById('press-summary-subtotal');
        const sumTotalEl = document.getElementById('press-summary-total');
        if (sumSubtotalEl) sumSubtotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' FCFA';
        if (sumTotalEl) sumTotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' FCFA';

        // Pré-remplir les infos utilisateur si connecté
        const user = bideGetCurrentUser();
        if (user) {
          const el = (id) => document.getElementById(id);
          if (el('press-nom') && user.nom) el('press-nom').value = user.nom;
          if (el('press-prenom') && user.prenom) el('press-prenom').value = user.prenom;
          if (el('press-email') && user.email) el('press-email').value = user.email;
          if (el('press-whatsapp') && user.whatsapp_number) el('press-whatsapp').value = user.whatsapp_number;
          if (el('press-whatsapp-code') && user.whatsapp_code) el('press-whatsapp-code').value = user.whatsapp_code;
        }
        // Ouvrir le modal de paiement pressing
        const pm = new bootstrap.Modal(document.getElementById('pressingPaymentModal'));
        pm.show();
        }); // fin checkAuthAndAction
      });
    }

    // Bouton Me localiser (pressing modal) — OpenStreetMap
    const pressLocateBtn = document.getElementById('press-locate-btn');
    if (pressLocateBtn) {
      pressLocateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        pressLocateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Localisation...';
        pressLocateBtn.disabled = true;
        osmGeolocate(
          (lat, lng, address) => {
            document.getElementById('press-address').value = address;
            pressLocateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Localisé';
            pressLocateBtn.style.background = '#e8fbe8';
            pressLocateBtn.style.color = '#16a34a';
            pressLocateBtn.style.borderColor = '#c5f0c5';
            pressLocateBtn.disabled = false;
            // Mettre à jour l'iframe carte
            const mapFrame = document.getElementById('press-map-iframe');
            if (mapFrame) mapFrame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (lng-0.05)+','+(lat-0.05)+','+(lng+0.05)+','+(lat+0.05)+'&layer=mapnik&marker='+lat+','+lng;
          },
          (msg) => {
            alert(msg);
            pressLocateBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Me localiser';
            pressLocateBtn.disabled = false;
          }
        );
      });
    }

    // RGPD pressing → activer bouton confirmer
    const pressRgpd = document.getElementById('press-rgpd');
    const pressConfirmBtn = document.getElementById('press-confirm-btn');
    if (pressRgpd && pressConfirmBtn) {
      pressRgpd.addEventListener('change', () => {
        pressConfirmBtn.disabled = !pressRgpd.checked;
      });
    }

    // Code promo pressing — validation en temps réel
    const pressPromoBtnEl = document.getElementById('press-promo-btn');
    const pressPromoInputEl = document.getElementById('press-promo-input');
    if (pressPromoBtnEl && pressPromoInputEl) {
      pressPromoBtnEl.addEventListener('click', () => {
        const code = pressPromoInputEl.value.trim().toUpperCase();
        if (!code) { alert('Veuillez saisir un code promo.'); return; }
        const promoInfo = window.validatePromoCode ? window.validatePromoCode(code) : null;
        if (!promoInfo) { alert('Code promo invalide ou expiré.'); return; }
        const totalEl = document.getElementById('press-summary-total');
        const currentTotal = totalEl ? parseInt(totalEl.textContent.replace(/[^0-9]/g, '')) : 0;
        const result = window.applyPromoDiscount(currentTotal, promoInfo);
        const discountRow = document.getElementById('press-promo-discount-row');
        const discountEl = document.getElementById('press-promo-discount');
        if (discountRow) discountRow.classList.remove('d-none');
        if (discountEl) discountEl.textContent = '-' + result.discount.toLocaleString('fr-FR') + ' FCFA';
        if (totalEl) totalEl.textContent = result.finalAmount.toLocaleString('fr-FR') + ' FCFA';
        pressPromoBtnEl.innerHTML = '<i class="fa-solid fa-check text-success"></i> Appliqué';
        pressPromoBtnEl.disabled = true;
        pressPromoInputEl.disabled = true;
      });
    }

    // Confirmation commande pressing
    if (pressConfirmBtn) {
      pressConfirmBtn.addEventListener('click', () => {
        // Valider les champs
        const nom = document.getElementById('press-nom')?.value.trim();
        const prenom = document.getElementById('press-prenom')?.value.trim();
        const email = document.getElementById('press-email')?.value.trim();
        const whatsappCode = document.getElementById('press-whatsapp-code')?.value || '+228';
        const whatsapp = document.getElementById('press-whatsapp')?.value.trim();
        const address = document.getElementById('press-address')?.value.trim();
        const date = document.getElementById('press-date')?.value;
        const time = document.getElementById('press-time')?.value;

        if (!nom || !prenom || !email || !whatsapp || !address || !date) {
          alert('Veuillez remplir tous les champs obligatoires.');
          return;
        }

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const orderId = 'BD-' + (1000 + Math.floor(Math.random() * 9000));

        // Appliquer le code promo si saisi
        const pressPromoCode = document.getElementById('press-promo-input')?.value.trim().toUpperCase() || null;
        let promoDiscount = 0;
        let promoCommissionAmount = 0;
        if (pressPromoCode && window.validatePromoCode) {
          const promoInfo = window.validatePromoCode(pressPromoCode);
          if (promoInfo) {
            const result = window.applyPromoDiscount(subtotal, promoInfo);
            promoDiscount = result.discount;
            promoCommissionAmount = result.commissionAmount;
          }
        }
        const finalTotal = subtotal - promoDiscount;

        const locData = JSON.parse(localStorage.getItem('bide_user_location') || '{}');
        const orderData = {
          id: orderId,
          service: 'Pressing',
          user_id: currentUser ? currentUser.id : null,
          nom: nom,
          prenom: prenom,
          email: email,
          whatsapp: whatsappCode + whatsapp,
          address: address,
          lat: locData.lat || null,
          lng: locData.lng || null,
          date: date,
          time: time,
          payment: document.getElementById('press-cash')?.checked ? 'cash' : 'mobile',
          items: cart.map(item => ({ name: item.name, qty: item.qty, price: item.price })),
          subtotal: subtotal,
          promo_code: pressPromoCode,
          promo_discount: promoDiscount,
          promo_commission: promoCommissionAmount,
          total: finalTotal,
          status: 'pending',
          rgpd_accepted: true,
          created_at: new Date().toISOString()
        };

        // Sauvegarder la commande
        const storedOrders = localStorage.getItem('bide_orders');
        const orders = storedOrders ? JSON.parse(storedOrders) : [];
        orders.push(orderData);
        localStorage.setItem('bide_orders', JSON.stringify(orders));
        // Enregistrer l'utilisation du code promo
        if (pressPromoCode && window.recordPromoUsage) window.recordPromoUsage(pressPromoCode, finalTotal);

        // Fermer le modal paiement, afficher merci
        const paymentModal = bootstrap.Modal.getInstance(document.getElementById('pressingPaymentModal'));
        if (paymentModal) paymentModal.hide();

        setTimeout(() => {
          document.getElementById('press-thank-you-id').textContent = '#' + orderId;
          new bootstrap.Modal(document.getElementById('pressingThankYouModal')).show();
          // Vider le panier
          cart.length = 0;
          updateCartUI();
        }, 400);
      });
    }
  }

  // Fonction de sélection de paiement (pression)
  window.selectPayment = function(box, type) {
    document.querySelectorAll('#pressingPaymentModal .payment-box').forEach(b => b.classList.remove('active'));
    box.classList.add('active');
    const radio = box.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  };

  // ============================================
  // 4. COMMANDE — Suivi de commande
  // ============================================
  const trackingForm = document.getElementById('tracking-form');
  const trackingError = document.getElementById('tracking-error');
  const trackingResults = document.getElementById('tracking-results');

  if (trackingForm) {
    trackingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('order-id-input');
      const orderId = input.value.trim().toUpperCase();

      // Recherche dans localStorage (base de données simulée)
      // TODO: Remplacer localStorage par Supabase plus tard
      const storedOrders = localStorage.getItem('bide_orders');
      const orders = storedOrders ? JSON.parse(storedOrders) : [];

      // Chercher la commande par ID
      const found = orders.find(o => o.id === orderId);

      if (found) {
        trackingError.classList.add('d-none');
        displayOrderFromDB(found);
      } else {
        // Aussi chercher dans les commandes de démo
        const sampleOrders = {
          'BD-1024': { id: '#BD-1024', eta: '21 aout 2026', step: 2, service: 'Pressing', items: [{ name: 'Costume complet', qty: 2, price: 8000 }, { name: 'Chemise classic', qty: 3, price: 4500 }], subtotal: 12500, shipping: 2000, total: 14500 },
          'BD-1025': { id: '#BD-1025', eta: '22 aout 2026', step: 1, service: 'Lavage Auto', items: [{ name: 'Lavage Standard Berline', qty: 1, price: 25000 }], subtotal: 25000, shipping: 0, total: 25000 }
        };
        if (sampleOrders[orderId]) {
          trackingError.classList.add('d-none');
          displayOrder(sampleOrders[orderId]);
        } else {
          trackingResults.classList.add('d-none');
          trackingError.classList.remove('d-none');
        }
      }
    });

    function displayOrderFromDB(order) {
      // Adapter le format pour l'affichage
      const adapted = {
        id: '#' + order.id,
        eta: order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : 'En attente',
        step: order.status === 'delivered' ? 4 : order.status === 'processing' ? 2 : order.status === 'shipped' ? 3 : 1,
        service: order.service || 'Service',
        items: order.items || [{ name: order.service || 'Service', qty: 1, price: order.total || 0 }],
        subtotal: order.subtotal || order.total || 0,
        shipping: order.shipping || 0,
        total: order.total || 0
      };
      displayOrder(adapted);
    }

    function displayOrder(order) {
      document.getElementById('display-order-id').textContent = order.id;
      document.getElementById('display-eta').textContent = order.eta;
      for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById('step-' + i);
        const lineEl = document.getElementById('line-' + i);
        if (stepEl) {
          if (i <= order.step) {
            stepEl.classList.add('active');
            stepEl.querySelector('.step-icon').classList.add('bg-primary', 'text-white');
          } else {
            stepEl.classList.remove('active');
            stepEl.querySelector('.step-icon').classList.remove('bg-primary', 'text-white');
          }
        }
        if (lineEl) {
          if (i < order.step) lineEl.classList.add('active');
          else lineEl.classList.remove('active');
        }
      }
      const tbody = document.getElementById('tracking-items-tbody');
      if (tbody) {
        tbody.innerHTML = order.items.map(item => '<tr class="border-bottom"><td><strong>' + item.name + '</strong></td><td class="text-center">' + item.qty + '</td><td class="text-end fw-bold">' + item.price.toLocaleString('fr-FR') + ' FCFA</td></tr>').join('');
      }
      document.getElementById('display-subtotal').textContent = order.subtotal.toLocaleString('fr-FR') + ' FCFA';
      document.getElementById('display-shipping').textContent = order.shipping > 0 ? order.shipping.toLocaleString('fr-FR') + ' FCFA' : 'Offert';
      document.getElementById('display-total').textContent = order.total.toLocaleString('fr-FR') + ' FCFA';
      trackingResults.classList.remove('d-none');
    }
  }

  // ============================================
  // 5. ENTRETIEN — Paiement box toggle + Localisation + Paiement mobile
  // ============================================
  const paymentBoxes = document.querySelectorAll('.payment-box');
  if (paymentBoxes.length > 0) {
    paymentBoxes.forEach(box => {
      box.addEventListener('click', () => {
        paymentBoxes.forEach(b => b.classList.remove('active'));
        box.classList.add('active');
        const radio = box.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });
  }

  // Bouton "Me localiser" (entretien) — OpenStreetMap
  const locateBtn = document.getElementById('ent-locate-btn');
  if (locateBtn) {
    locateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      locateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Localisation...';
      locateBtn.disabled = true;
      osmGeolocate(
        (lat, lng, address) => {
          document.getElementById('form-address').value = address;
          locateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Localisé';
          locateBtn.style.background = '#e8fbe8';
          locateBtn.style.color = '#16a34a';
          locateBtn.style.borderColor = '#c5f0c5';
          locateBtn.disabled = false;
          // Mettre à jour l'iframe carte
          const mapFrame = document.getElementById('ent-map-iframe');
          if (mapFrame) mapFrame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (lng-0.05)+','+(lat-0.05)+','+(lng+0.05)+','+(lat+0.05)+'&layer=mapnik&marker='+lat+','+lng;
        },
        (msg) => {
          alert(msg);
          locateBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Me localiser';
          locateBtn.disabled = false;
        }
      );
    });
  }

  // Paiement Mobile Money → Redirection vers l'app bancaire
  const mobileRadio = document.getElementById('mobile');
  if (mobileRadio) {
    mobileRadio.addEventListener('change', () => {
      // TODO: En prod, intégrer l'API Wave/Orange/MTN
      // Pour l'instant, informer l'utilisateur
      const paymentBox = mobileRadio.closest('.payment-box');
      if (paymentBox) {
        const label = paymentBox.querySelector('label');
        if (label) {
          const info = label.querySelector('.extra-small');
          if (info) info.textContent = 'Redirection vers votre app bancaire à la confirmation';
        }
      }
    });
  }

  // ============================================
  // 5b. ENTRETIEN — Prix dynamiques services
  // ============================================
  const interventionCheckboxes = document.querySelectorAll('#intervention-services input[type="checkbox"]');
  const resumeServices = document.getElementById('resume-services');
  const resumeSubtotal = document.getElementById('resume-subtotal');
  const resumeTotal = document.getElementById('resume-total');

  if (interventionCheckboxes.length > 0 && resumeServices) {
    interventionCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        // Mettre à jour l'item coché (fond bleu)
        const item = cb.closest('.intervention-item');
        if (item) {
          item.style.backgroundColor = cb.checked ? '#eef4ff' : '#f8faff';
          item.style.borderLeft = cb.checked ? '3px solid #0b4db7' : 'none';
        }
        // Recalculer le total
        updateEntretienResume();
      });
    });

    function updateEntretienResume() {
      let subtotal = 0;
      const items = [];
      interventionCheckboxes.forEach(cb => {
        if (cb.checked) {
          const price = parseInt(cb.getAttribute('data-price')) || 0;
          const name = cb.closest('.intervention-item').querySelector('label span:first-child')?.textContent.trim() || cb.value;
          subtotal += price;
          items.push({ name, price });
        }
      });

      // Afficher les services sélectionnés
      if (items.length === 0) {
        resumeServices.innerHTML = '<p class="extra-small text-muted text-center py-2 mb-0">Aucun service sélectionné</p>';
      } else {
        resumeServices.innerHTML = items.map(item => 
          '<div class="d-flex justify-content-between align-items-center mb-1">' +
          '<span class="small"><i class="fa-solid fa-wrench text-primary me-1" style="font-size:0.7rem;"></i>' + item.name + '</span>' +
          '<span class="fw-bold small">' + item.price.toLocaleString('fr-FR') + ' FCFA</span>' +
          '</div>'
        ).join('');
      }

      const shipping = 2000;
      const total = subtotal + shipping;
      if (resumeSubtotal) resumeSubtotal.textContent = subtotal.toLocaleString('fr-FR') + ' FCFA';
      if (resumeTotal) resumeTotal.textContent = total.toLocaleString('fr-FR') + ' FCFA';
    }
  }

  // ============================================
  // 6. ENTRETIEN — Mode Invité / Connexion
  // ============================================
  const authChoiceSection = document.getElementById('auth-choice-section');
  const reservationFormSection = document.getElementById('reservation-form-section');
  const merciSection = document.getElementById('merci-section');
  const merciCreateAccount = document.getElementById('merci-create-account');
  const btnGuest = document.getElementById('btn-guest');
  const btnLogin = document.getElementById('btn-login');
  const btnCreateAccount = document.getElementById('btn-create-account');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const confirmBtn = reservationFormSection ? reservationFormSection.querySelector('.btn-primary.fw-bold') : null;

  // TODO: Remplacer localStorage par Supabase plus tard
  let currentUser = null;

  function showForm() {
    if (authChoiceSection) authChoiceSection.classList.add('d-none');
    if (reservationFormSection) reservationFormSection.classList.remove('d-none');
  }

  function showMerci(orderId) {
    if (reservationFormSection) reservationFormSection.classList.add('d-none');
    if (merciSection) {
      merciSection.classList.remove('d-none');
      const orderIdEl = document.getElementById('merci-order-id');
      if (orderIdEl) orderIdEl.textContent = orderId;
    }
    if (merciCreateAccount) {
      merciCreateAccount.style.display = currentUser ? 'none' : 'block';
    }
  }

  function prefillForm(user) {
    const fields = {
      'form-nom': user.nom || '',
      'form-prenom': user.prenom || '',
      'form-email': user.email || '',
      'form-whatsapp': user.whatsapp || ''
    };
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    }
  }

  if (btnGuest) {
    btnGuest.addEventListener('click', () => {
      currentUser = null;
      showForm();
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const modal = new bootstrap.Modal(document.getElementById('authModal'));
      modal.show();
    });
  }

  // Formulaire CONNEXION
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      // TODO: Remplacer localStorage par Supabase plus tard
      const stored = localStorage.getItem('bide_users');
      const users = stored ? JSON.parse(stored) : [];
      const found = users.find(u => u.email === email && u.password === password);
      if (found) {
        currentUser = found;
        localStorage.setItem('bide_current_user', JSON.stringify(found));
        localStorage.setItem('bide_auth_mode', 'user');
        const modalEl = document.getElementById('authModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        showForm();
        prefillForm(found);
      } else {
        alert('Email ou mot de passe incorrect.\nEssayez avec les identifiants de votre compte.');
      }
    });
  }

  // Formulaire INSCRIPTION
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Vérifier l'acceptation des conditions
      const acceptConditions = document.getElementById('reg-accept-conditions');
      if (acceptConditions && !acceptConditions.checked) {
        alert('Vous devez accepter les Conditions Générales et la Politique de Confidentialité pour créer un compte.');
        return;
      }

      // Construire le numéro complet avec le code international
      const phoneCode = document.getElementById('reg-whatsapp-code');
      const codeValue = phoneCode ? phoneCode.value : '+228';
      const phoneValue = document.getElementById('reg-whatsapp').value.trim();

      const newUser = {
        id: 'user_' + Date.now(),
        nom: document.getElementById('reg-nom').value.trim(),
        prenom: document.getElementById('reg-prenom').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        whatsapp: codeValue + phoneValue,
        whatsapp_code: codeValue,
        whatsapp_number: phoneValue,
        password: document.getElementById('reg-password').value
      };
      // TODO: Remplacer localStorage par Supabase plus tard
      const stored = localStorage.getItem('bide_users');
      const users = stored ? JSON.parse(stored) : [];
      if (users.find(u => u.email === newUser.email)) {
        alert('Un compte existe déjà avec cet email.');
        return;
      }
      users.push(newUser);
      localStorage.setItem('bide_users', JSON.stringify(users));
      currentUser = newUser;
      localStorage.setItem('bide_current_user', JSON.stringify(newUser));
      localStorage.setItem('bide_auth_mode', 'user');
      const modalEl = document.getElementById('authModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
      showForm();
      prefillForm(newUser);
    });
  }

  // ============================================
  // 7. ENTRETIEN — Soumission commande
  // ============================================
  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // Collecter les services sélectionnés
      const selectedServices = [];
      let subtotal = 0;
      document.querySelectorAll('#intervention-services input[type="checkbox"]:checked').forEach(cb => {
        const price = parseInt(cb.getAttribute('data-price')) || 0;
        const name = cb.closest('.intervention-item')?.querySelector('label span:first-child')?.textContent.trim() || cb.value;
        selectedServices.push({ name, price, qty: 1 });
        subtotal += price;
      });
      const shipping = 2000;
      const total = subtotal + shipping;

      // Récupérer la position GPS si disponible
      const locData = JSON.parse(localStorage.getItem('bide_user_location') || '{}');

      const orderData = {
        id: 'BD-' + (1000 + Math.floor(Math.random() * 9000)),
        user_id: currentUser ? currentUser.id : null,
        nom: document.getElementById('form-nom')?.value || '',
        prenom: document.getElementById('form-prenom')?.value || '',
        email: document.getElementById('form-email')?.value || '',
        whatsapp: document.getElementById('form-whatsapp')?.value || '',
        plaque: document.getElementById('form-plaque')?.value || '',
        address: document.getElementById('form-address')?.value || '',
        lat: locData.lat || null,
        lng: locData.lng || null,
        service: 'Entretien Mécanique',
        status: 'pending',
        items: selectedServices.length > 0 ? selectedServices : [{ name: 'Devis à définir', qty: 1, price: 0 }],
        subtotal: subtotal,
        shipping: shipping,
        total: total,
        rgpd_accepted: document.getElementById('rgpd-checkbox')?.checked || false,
        created_at: new Date().toISOString()
      };

      // Validation
      if (!orderData.nom || !orderData.prenom || !orderData.email || !orderData.whatsapp) {
        alert('Veuillez remplir tous les champs obligatoires (Nom, Prénoms, Email, WhatsApp).');
        return;
      }
      if (selectedServices.length === 0) {
        alert('Veuillez sélectionner au moins un service.');
        return;
      }
      if (!orderData.rgpd_accepted) {
        alert('Veuillez accepter les Conditions Générales et la Politique de Confidentialité.');
        return;
      }

      // Sauvegarder
      // TODO: Remplacer localStorage par Supabase plus tard
      const storedOrders = localStorage.getItem('bide_orders');
      const orders = storedOrders ? JSON.parse(storedOrders) : [];
      orders.push(orderData);
      localStorage.setItem('bide_orders', JSON.stringify(orders));

      // Si paiement mobile, rediriger
      const mobilePay = document.getElementById('mobile');
      if (mobilePay && mobilePay.checked) {
        // TODO: En prod, rediriger vers l'URL du provider de paiement
        alert('Redirection vers votre application de paiement mobile...');
      }

      showMerci(orderData.id);
    });
  }

  // Bouton "Créer mon compte en 1 clic"
  if (btnCreateAccount) {
    btnCreateAccount.addEventListener('click', () => {
      // TODO: Remplacer localStorage par Supabase plus tard
      const storedOrders = localStorage.getItem('bide_orders');
      const orders = storedOrders ? JSON.parse(storedOrders) : [];
      const lastOrder = orders[orders.length - 1];
      if (!lastOrder) return;

      const userId = 'user_' + Date.now();
      const newUser = {
        id: userId,
        nom: lastOrder.nom,
        prenom: lastOrder.prenom,
        email: lastOrder.email,
        whatsapp: lastOrder.whatsapp
      };

      const storedUsers = localStorage.getItem('bide_users');
      const users = storedUsers ? JSON.parse(storedUsers) : [];
      users.push({ ...newUser, password: null });
      localStorage.setItem('bide_users', JSON.stringify(users));

      // Lier les anciennes commandes
      const updatedOrders = orders.map(o => {
        if (o.whatsapp === lastOrder.whatsapp && !o.user_id) {
          return { ...o, user_id: userId };
        }
        return o;
      });
      localStorage.setItem('bide_orders', JSON.stringify(updatedOrders));

      currentUser = newUser;
      localStorage.setItem('bide_current_user', JSON.stringify(newUser));
      localStorage.setItem('bide_auth_mode', 'user');

      btnCreateAccount.innerHTML = '<i class="fa-solid fa-check me-1"></i> Compte créé !';
      btnCreateAccount.classList.remove('btn-primary');
      btnCreateAccount.classList.add('btn-success');
      btnCreateAccount.disabled = true;
    });
  }

  // ============================================
  // 8. CASE RGPD + BOUTON CONFIRMER
  // ============================================
  const rgpdCheckbox = document.getElementById('rgpd-checkbox');
  const btnConfirmOrder = document.getElementById('btn-confirm-order');

  if (rgpdCheckbox && btnConfirmOrder) {
    rgpdCheckbox.addEventListener('change', () => {
      btnConfirmOrder.disabled = !rgpdCheckbox.checked;
    });
  }

});

// ============================================
// SYSTÈME D'AUTHENTIFICATION GLOBAL
// checkAuthAndAction(callback) — appelé par tous les boutons
// ============================================

// TODO: Remplacer localStorage par Supabase plus tard

function checkAuthAndAction(callback) {
  const authMode = localStorage.getItem('bide_auth_mode');
  if (authMode) {
    callback();
    return;
  }
  showAuthChoiceModal(callback);
}

function showAuthChoiceModal(callback) {
  let modalEl = document.getElementById('globalAuthModal');
  if (!modalEl) {
    modalEl = createAuthModal();
    document.body.appendChild(modalEl);
  }
  const modal = new bootstrap.Modal(modalEl);
  const btnGuestGlobal = document.getElementById('global-btn-guest');
  const btnLoginGlobal = document.getElementById('global-btn-login');

  // Nettoyer les anciens listeners
  const newBtnGuest = btnGuestGlobal.cloneNode(true);
  btnGuestGlobal.parentNode.replaceChild(newBtnGuest, btnGuestGlobal);
  const newBtnLogin = btnLoginGlobal.cloneNode(true);
  btnLoginGlobal.parentNode.replaceChild(newBtnLogin, btnLoginGlobal);

  newBtnGuest.addEventListener('click', () => {
    localStorage.setItem('bide_auth_mode', 'guest');
    modal.hide();
    callback();
  });

  newBtnLogin.addEventListener('click', () => {
    modal.hide();
    setTimeout(() => {
      const loginModalEl = document.getElementById('authModal');
      if (loginModalEl) {
        new bootstrap.Modal(loginModalEl).show();
      } else {
        alert('Système de connexion en cours de développement.');
      }
    }, 400);
  });

  modal.show();
}

function createAuthModal() {
  const div = document.createElement('div');
  div.className = 'modal fade';
  div.id = 'globalAuthModal';
  div.tabIndex = -1;
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg rounded-4">
        <div class="modal-body p-5 text-center">
          <div class="mb-4">
            <div class="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style="width: 64px; height: 64px; background-color: #eef4ff; color: #0b4db7;">
              <i class="fa-solid fa-user-check fs-3"></i>
            </div>
            <h3 class="h5 fw-bold text-dark mb-2">Avant de continuer...</h3>
            <p class="text-muted small mb-0">Choisissez comment accéder à votre espace Bidè.</p>
          </div>
          <div class="row g-3 justify-content-center">
            <div class="col-sm-5">
              <button id="global-btn-guest" class="btn w-100 p-3 border-0 rounded-4 text-start" style="background-color: #f8faff; border: 2px solid #e7edf8 !important;">
                <i class="fa-solid fa-arrow-right-to-bracket fs-3 text-primary mb-2 d-block"></i>
                <strong class="d-block text-dark">Continuer en tant qu'Invité</strong>
                <span class="text-muted extra-small">Pas besoin de compte</span>
              </button>
            </div>
            <div class="col-sm-5">
              <button id="global-btn-login" class="btn w-100 p-3 border-0 rounded-4 text-start" style="background-color: #f8faff; border: 2px solid #e7edf8 !important;">
                <i class="fa-solid fa-right-to-bracket fs-3 text-primary mb-2 d-block"></i>
                <strong class="d-block text-dark">Se connecter / S'inscrire</strong>
                <span class="text-muted extra-small">Espace personnel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  return div;
}

function bideLogout() {
  localStorage.removeItem('bide_auth_mode');
  localStorage.removeItem('bide_current_user');
  window.location.href = 'index.html';
}

function bideGetCurrentUser() {
  const stored = localStorage.getItem('bide_current_user');
  return stored ? JSON.parse(stored) : null;
}

// ============================================
// CONNEXION DES BOUTONS AU SITE
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // Tous les boutons "Réserver avec Bidè" / "Réserver maintenant"
  document.querySelectorAll('button').forEach(btn => {
    const text = btn.textContent.trim();
    if (text.includes('Réserver avec Bidè') || text.includes('Réserver maintenant')) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        checkAuthAndAction(() => {
          window.location.href = 'entretien.html';
        });
      });
    }
  });

  // Bouton "Ajouter au panier" (Pressing) — vérifier auth d'abord
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const authMode = localStorage.getItem('bide_auth_mode');
      if (!authMode) {
        e.preventDefault();
        e.stopPropagation();
        checkAuthAndAction(() => {
          btn.dataset.authClicked = 'true';
          btn.click();
        });
      }
    });
  });

  // Bouton "Confirmer la commande"
  const confirmBtnGlobal = document.getElementById('btn-confirm-order');
  if (confirmBtnGlobal) {
    confirmBtnGlobal.addEventListener('click', (e) => {
      e.preventDefault();
      const rgpd = document.getElementById('rgpd-checkbox');
      if (rgpd && !rgpd.checked) {
        alert('Veuillez accepter les Conditions Générales et la Politique de Confidentialité pour continuer.');
        return;
      }
    });
  }

  // Bouton "Mon Compte" (icône user navbar)
  document.querySelectorAll('.navbar .btn.rounded-circle').forEach(btn => {
    if (btn.querySelector('.fa-user')) {
      btn.addEventListener('click', () => {
        const user = bideGetCurrentUser();
        if (user) {
          alert('Bienvenue ' + user.prenom + ' !\nEspace profil en cours de développement.');
        } else {
          const loginModalEl = document.getElementById('authModal');
          if (loginModalEl) {
            new bootstrap.Modal(loginModalEl).show();
          }
        }
      });
    }
  });

  // ============================================
  // BOUTONS "CHOISIR" — LAVAGE vs ENTRETIEN
  // - .lavage-plan-btn → modal paiement lavage intégré
  // - autres card-plan .btn → redirection entretien.html
  // ============================================

  // Boutons LAVAGE (Express/Standard/Premium/Rénovation) → ouvrent le modal paiement lavage
  document.querySelectorAll('.lavage-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      checkAuthAndAction(() => {
        const plan = btn.getAttribute('data-plan');
        const price = parseInt(btn.getAttribute('data-price'));
        // Remplir le résumé du modal
        const planEl = document.getElementById('lav-summary-plan');
        const priceEl = document.getElementById('lav-summary-price');
        const subtotalEl = document.getElementById('lav-summary-subtotal');
        const totalEl = document.getElementById('lav-summary-total');
        const titleEl = document.getElementById('lavage-modal-title');
        if (planEl) planEl.textContent = plan;
        if (priceEl) priceEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (subtotalEl) subtotalEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (totalEl) totalEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (titleEl) titleEl.textContent = 'Paiement ' + plan;
        // Pré-remplir les infos utilisateur si connecté
        const user = bideGetCurrentUser();
        if (user) {
          const el = (id) => document.getElementById(id);
          if (el('lav-nom') && user.nom) el('lav-nom').value = user.nom;
          if (el('lav-prenom') && user.prenom) el('lav-prenom').value = user.prenom;
          if (el('lav-email') && user.email) el('lav-email').value = user.email;
          if (el('lav-whatsapp') && user.whatsapp_number) el('lav-whatsapp').value = user.whatsapp_number;
          if (el('lav-whatsapp-code') && user.whatsapp_code) el('lav-whatsapp-code').value = user.whatsapp_code;
        }
        // Ouvrir le modal de paiement lavage
        new bootstrap.Modal(document.getElementById('lavagePaymentModal')).show();
      });
    });
  });

  // Boutons ENTRETIEN (autres card-plan) → redirection entretien.html
  document.querySelectorAll('.card-plan .btn:not(.lavage-plan-btn):not(.menage-plan-btn)').forEach(btn => {
    if (btn.textContent.includes('Choisir') || btn.textContent.includes('Demander')) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        checkAuthAndAction(() => {
          window.location.href = 'entretien.html';
        });
      });
    }
  });

  // ============================================
  // MODAL PAIEMENT LAVAGE — RGPD, Géolocalisation, Confirmation
  // ============================================

  // RGPD lavage → activer/désactiver bouton confirmer
  const lavRgpd = document.getElementById('lav-rgpd');
  const lavConfirmBtn = document.getElementById('lav-confirm-btn');
  if (lavRgpd && lavConfirmBtn) {
    lavRgpd.addEventListener('change', () => {
      lavConfirmBtn.disabled = !lavRgpd.checked;
    });
  }

  // Code promo lavage — validation en temps réel
  const lavPromoBtnEl = document.getElementById('lav-promo-btn');
  const lavPromoInputEl = document.getElementById('lav-promo-input');
  if (lavPromoBtnEl && lavPromoInputEl) {
    lavPromoBtnEl.addEventListener('click', () => {
      const code = lavPromoInputEl.value.trim().toUpperCase();
      if (!code) { alert('Veuillez saisir un code promo.'); return; }
      const promoInfo = window.validatePromoCode ? window.validatePromoCode(code) : null;
      if (!promoInfo) {
        alert('Code promo invalide ou expiré.');
        return;
      }
      // Lire le montant actuel du total
      const totalEl = document.getElementById('lav-summary-total');
      const currentTotal = totalEl ? parseInt(totalEl.textContent.replace(/[^0-9]/g, '')) : 25000;
      const result = window.applyPromoDiscount(currentTotal, promoInfo);
      const discountRow = document.getElementById('lav-promo-discount-row');
      const discountEl = document.getElementById('lav-promo-discount');
      if (discountRow) discountRow.classList.remove('d-none');
      if (discountEl) discountEl.textContent = '-' + result.discount.toLocaleString('fr-FR') + ' FCFA';
      if (totalEl) totalEl.textContent = result.finalAmount.toLocaleString('fr-FR') + ' FCFA';
      lavPromoBtnEl.innerHTML = '<i class="fa-solid fa-check text-success"></i> Appliqué';
      lavPromoBtnEl.disabled = true;
      lavPromoInputEl.disabled = true;
    });
  }

  // Bouton Me localiser (lavage modal) — OpenStreetMap
  const lavLocateBtn = document.getElementById('lav-locate-btn');
  if (lavLocateBtn) {
    lavLocateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      lavLocateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Localisation...';
      lavLocateBtn.disabled = true;
      osmGeolocate(
        (lat, lng, address) => {
          document.getElementById('lav-address').value = address;
          lavLocateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Localisé';
          lavLocateBtn.style.background = '#e8fbe8';
          lavLocateBtn.style.color = '#16a34a';
          lavLocateBtn.style.borderColor = '#c5f0c5';
          lavLocateBtn.disabled = false;
          const mapFrame = document.getElementById('lav-map-iframe');
          if (mapFrame) mapFrame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (lng-0.05)+','+(lat-0.05)+','+(lng+0.05)+','+(lat+0.05)+'&layer=mapnik&marker='+lat+','+lng;
        },
        (msg) => {
          alert(msg);
          lavLocateBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Me localiser';
          lavLocateBtn.disabled = false;
        }
      );
    });
  }

  // Confirmation commande lavage
  if (lavConfirmBtn) {
    lavConfirmBtn.addEventListener('click', () => {
      const nom = document.getElementById('lav-nom')?.value.trim();
      const prenom = document.getElementById('lav-prenom')?.value.trim();
      const email = document.getElementById('lav-email')?.value.trim();
      const whatsappCode = document.getElementById('lav-whatsapp-code')?.value || '+228';
      const whatsapp = document.getElementById('lav-whatsapp')?.value.trim();
      const plaque = document.getElementById('lav-plaque')?.value.trim();
      const address = document.getElementById('lav-address')?.value.trim();
      const date = document.getElementById('lav-date')?.value;
      const time = document.getElementById('lav-time')?.value;
      const plan = document.getElementById('lav-summary-plan')?.textContent;
      const total = document.getElementById('lav-summary-total')?.textContent;

      if (!nom || !prenom || !email || !whatsapp || !plaque || !date) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      const orderId = 'BD-' + (1000 + Math.floor(Math.random() * 9000));
      const locData = JSON.parse(localStorage.getItem('bide_user_location') || '{}');
      const subtotalAmount = parseInt(total.replace(/[^0-9]/g, ''));

      // Appliquer le code promo si saisi
      const lavPromoCode = document.getElementById('lav-promo-input')?.value.trim().toUpperCase() || null;
      let promoDiscount = 0;
      let promoCommissionAmount = 0;
      if (lavPromoCode && window.validatePromoCode) {
        const promoInfo = window.validatePromoCode(lavPromoCode);
        if (promoInfo) {
          const result = window.applyPromoDiscount(subtotalAmount, promoInfo);
          promoDiscount = result.discount;
          promoCommissionAmount = result.commissionAmount;
        }
      }
      const finalTotal = subtotalAmount - promoDiscount;

      const orderData = {
        id: orderId,
        service: 'Lavage Auto',
        plan: plan,
        user_id: bideGetCurrentUser()?.id || null,
        nom, prenom, email,
        whatsapp: whatsappCode + whatsapp,
        plaque, address, lat: locData.lat || null, lng: locData.lng || null, date, time,
        payment: document.getElementById('lav-cash')?.checked ? 'cash' : 'mobile',
        items: [{ name: 'Lavage ' + plan, qty: 1, price: subtotalAmount }],
        subtotal: subtotalAmount,
        promo_code: lavPromoCode,
        promo_discount: promoDiscount,
        promo_commission: promoCommissionAmount,
        total: finalTotal,
        shipping: 0,
        status: 'pending',
        rgpd_accepted: true,
        created_at: new Date().toISOString()
      };

      // Sauvegarder la commande
      const storedOrders = localStorage.getItem('bide_orders');
      const orders = storedOrders ? JSON.parse(storedOrders) : [];
      orders.push(orderData);
      localStorage.setItem('bide_orders', JSON.stringify(orders));
      // Enregistrer l'utilisation du code promo
      if (lavPromoCode && window.recordPromoUsage) window.recordPromoUsage(lavPromoCode, finalTotal);

      // Paiement mobile → informer
      if (document.getElementById('lav-mobile')?.checked) {
        alert('Redirection vers votre application de paiement mobile...');
      }

      // Fermer le modal paiement, afficher merci
      const pm = bootstrap.Modal.getInstance(document.getElementById('lavagePaymentModal'));
      if (pm) pm.hide();
      setTimeout(() => {
        document.getElementById('lav-thank-you-id').textContent = '#' + orderId;
        new bootstrap.Modal(document.getElementById('lavageThankYouModal')).show();
      }, 400);
    });
  }

  // Sélection paiement lavage
  window.selectLavagePayment = function(box, type) {
    document.querySelectorAll('#lavagePaymentModal .payment-box').forEach(b => b.classList.remove('active'));
    box.classList.add('active');
    const radio = box.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  };

  // ============================================
  // BOUTONS MÉNAGE — ouvrent le modal paiement intégré sur menage.html
  // ============================================
  document.querySelectorAll('.menage-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      checkAuthAndAction(() => {
        const plan = btn.getAttribute('data-plan');
        const price = parseInt(btn.getAttribute('data-price'));
        const planEl = document.getElementById('menage-summary-plan');
        const priceEl = document.getElementById('menage-summary-price');
        const subtotalEl = document.getElementById('menage-summary-subtotal');
        const totalEl = document.getElementById('menage-summary-total');
        const titleEl = document.getElementById('menage-modal-title');
        if (planEl) planEl.textContent = plan;
        if (priceEl) priceEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (subtotalEl) subtotalEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (totalEl) totalEl.textContent = price.toLocaleString('fr-FR') + ' FCFA';
        if (titleEl) titleEl.textContent = 'Paiement ' + plan;
        // Pré-remplir les infos utilisateur si connecté
        const user = bideGetCurrentUser();
        if (user) {
          const el = (id) => document.getElementById(id);
          if (el('menage-nom') && user.nom) el('menage-nom').value = user.nom;
          if (el('menage-prenom') && user.prenom) el('menage-prenom').value = user.prenom;
          if (el('menage-email') && user.email) el('menage-email').value = user.email;
          if (el('menage-whatsapp') && user.whatsapp_number) el('menage-whatsapp').value = user.whatsapp_number;
          if (el('menage-whatsapp-code') && user.whatsapp_code) el('menage-whatsapp-code').value = user.whatsapp_code;
        }
        new bootstrap.Modal(document.getElementById('menagePaymentModal')).show();
      });
    });
  });

  // RGPD ménage → activer/désactiver bouton confirmer
  const menageRgpd = document.getElementById('menage-rgpd');
  const menageConfirmBtn = document.getElementById('menage-confirm-btn');
  if (menageRgpd && menageConfirmBtn) {
    menageRgpd.addEventListener('change', () => {
      menageConfirmBtn.disabled = !menageRgpd.checked;
    });
  }

  // Code promo ménage — validation en temps réel
  const menagePromoBtnEl = document.getElementById('menage-promo-btn');
  const menagePromoInputEl = document.getElementById('menage-promo-input');
  if (menagePromoBtnEl && menagePromoInputEl) {
    menagePromoBtnEl.addEventListener('click', () => {
      const code = menagePromoInputEl.value.trim().toUpperCase();
      if (!code) { alert('Veuillez saisir un code promo.'); return; }
      const promoInfo = window.validatePromoCode ? window.validatePromoCode(code) : null;
      if (!promoInfo) { alert('Code promo invalide ou expiré.'); return; }
      const totalEl = document.getElementById('menage-summary-total');
      const currentTotal = totalEl ? parseInt(totalEl.textContent.replace(/[^0-9]/g, '')) : 0;
      const result = window.applyPromoDiscount(currentTotal, promoInfo);
      const discountRow = document.getElementById('menage-promo-discount-row');
      const discountEl = document.getElementById('menage-promo-discount');
      if (discountRow) discountRow.classList.remove('d-none');
      if (discountEl) discountEl.textContent = '-' + result.discount.toLocaleString('fr-FR') + ' FCFA';
      if (totalEl) totalEl.textContent = result.finalAmount.toLocaleString('fr-FR') + ' FCFA';
      menagePromoBtnEl.innerHTML = '<i class="fa-solid fa-check text-success"></i> Appliqué';
      menagePromoBtnEl.disabled = true;
      menagePromoInputEl.disabled = true;
    });
  }

  // Bouton Me localiser (ménage modal) — OpenStreetMap
  const menageLocateBtn = document.getElementById('menage-locate-btn');
  if (menageLocateBtn) {
    menageLocateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      menageLocateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Localisation...';
      menageLocateBtn.disabled = true;
      osmGeolocate(
        (lat, lng, address) => {
          document.getElementById('menage-address').value = address;
          menageLocateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Localisé';
          menageLocateBtn.style.background = '#e8fbe8';
          menageLocateBtn.style.color = '#16a34a';
          menageLocateBtn.style.borderColor = '#c5f0c5';
          menageLocateBtn.disabled = false;
          const mapFrame = document.getElementById('menage-map-iframe');
          if (mapFrame) mapFrame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (lng-0.05)+','+(lat-0.05)+','+(lng+0.05)+','+(lat+0.05)+'&layer=mapnik&marker='+lat+','+lng;
        },
        (msg) => {
          alert(msg);
          menageLocateBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Me localiser';
          menageLocateBtn.disabled = false;
        }
      );
    });
  }

  // Confirmation commande ménage
  if (menageConfirmBtn) {
    menageConfirmBtn.addEventListener('click', () => {
      const nom = document.getElementById('menage-nom')?.value.trim();
      const prenom = document.getElementById('menage-prenom')?.value.trim();
      const email = document.getElementById('menage-email')?.value.trim();
      const whatsappCode = document.getElementById('menage-whatsapp-code')?.value || '+228';
      const whatsapp = document.getElementById('menage-whatsapp')?.value.trim();
      const address = document.getElementById('menage-address')?.value.trim();
      const date = document.getElementById('menage-date')?.value;
      const time = document.getElementById('menage-time')?.value;
      const plan = document.getElementById('menage-summary-plan')?.textContent;
      const totalText = document.getElementById('menage-summary-total')?.textContent;

      if (!nom || !prenom || !email || !whatsapp || !date) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      const orderId = 'BD-' + (1000 + Math.floor(Math.random() * 9000));
      const totalVal = parseInt(totalText.replace(/[^0-9]/g, ''));
      const locData = JSON.parse(localStorage.getItem('bide_user_location') || '{}');

      // Appliquer le code promo si saisi
      const menagePromoCode = document.getElementById('menage-promo-input')?.value.trim().toUpperCase() || null;
      let promoDiscount = 0;
      let promoCommissionAmount = 0;
      if (menagePromoCode && window.validatePromoCode) {
        const promoInfo = window.validatePromoCode(menagePromoCode);
        if (promoInfo) {
          const result = window.applyPromoDiscount(totalVal, promoInfo);
          promoDiscount = result.discount;
          promoCommissionAmount = result.commissionAmount;
        }
      }
      const finalTotal = totalVal - promoDiscount;

      const orderData = {
        id: orderId,
        service: 'Ménage Immobilier',
        plan: plan,
        user_id: bideGetCurrentUser()?.id || null,
        nom, prenom, email,
        whatsapp: whatsappCode + whatsapp,
        address, lat: locData.lat || null, lng: locData.lng || null, date, time,
        payment: document.getElementById('menage-cash')?.checked ? 'cash' : 'mobile',
        items: [{ name: 'Ménage ' + plan, qty: 1, price: totalVal }],
        subtotal: totalVal,
        promo_code: menagePromoCode,
        promo_discount: promoDiscount,
        promo_commission: promoCommissionAmount,
        total: finalTotal,
        shipping: 0,
        status: 'pending',
        rgpd_accepted: true,
        created_at: new Date().toISOString()
      };

      const storedOrders = localStorage.getItem('bide_orders');
      const orders = storedOrders ? JSON.parse(storedOrders) : [];
      orders.push(orderData);
      localStorage.setItem('bide_orders', JSON.stringify(orders));
      // Enregistrer l'utilisation du code promo
      if (menagePromoCode && window.recordPromoUsage) window.recordPromoUsage(menagePromoCode, finalTotal);

      if (document.getElementById('menage-mobile')?.checked) {
        alert('Redirection vers votre application de paiement mobile...');
      }

      const pm = bootstrap.Modal.getInstance(document.getElementById('menagePaymentModal'));
      if (pm) pm.hide();
      setTimeout(() => {
        document.getElementById('menage-thank-you-id').textContent = '#' + orderId;
        new bootstrap.Modal(document.getElementById('menageThankYouModal')).show();
      }, 400);
    });
  }

  // Sélection paiement ménage
  window.selectMenagePayment = function(box, type) {
    document.querySelectorAll('#menagePaymentModal .payment-box').forEach(b => b.classList.remove('active'));
    box.classList.add('active');
    const radio = box.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  };

  // Boutons "Découvrir" (cartes services)
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    if (link.textContent.includes('Découvrir')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        checkAuthAndAction(() => {
          window.location.href = link.getAttribute('href');
        });
      });
    }
  });

});

// ============================================
// MODAL LOGIN/INSCRIPTION GLOBAL (pour les pages qui n'en ont pas)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('authModal')) {
    const authModalHTML = `
      <div class="modal fade" id="authModal" tabindex="-1" aria-labelledby="authModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg rounded-4">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold" id="authModalLabel">Bienvenue sur Bidè</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body pt-2">
              <ul class="nav nav-pills nav-fill mb-4 p-1 bg-light rounded-3" id="global-auth-tabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active fw-semibold rounded-3" data-bs-toggle="pill" data-bs-target="#g-pane-login" type="button" role="tab">
                    <i class="fa-solid fa-right-to-bracket me-1"></i> Connexion
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link fw-semibold rounded-3" data-bs-toggle="pill" data-bs-target="#g-pane-register" type="button" role="tab">
                    <i class="fa-solid fa-user-plus me-1"></i> Inscription
                  </button>
                </li>
              </ul>
              <div class="tab-content">
                <div class="tab-pane fade show active" id="g-pane-login" role="tabpanel">
                  <form id="global-login-form">
                    <div class="mb-3">
                      <label class="form-label text-muted small fw-semibold">Email</label>
                      <input type="email" class="form-control" placeholder="exemple@email.com" required>
                    </div>
                    <div class="mb-3">
                      <label class="form-label text-muted small fw-semibold">Mot de passe</label>
                      <input type="password" class="form-control" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100 py-2.5 fw-bold rounded-3">
                      <i class="fa-solid fa-right-to-bracket me-1"></i> Se connecter
                    </button>
                  </form>
                </div>
                <div class="tab-pane fade" id="g-pane-register" role="tabpanel">
                  <form id="global-register-form">
                    <div class="row g-3">
                      <div class="col-md-6">
                        <label class="form-label text-muted small fw-semibold">Nom</label>
                        <input type="text" class="form-control" id="g-reg-nom" required>
                      </div>
                      <div class="col-md-6">
                        <label class="form-label text-muted small fw-semibold">Prénoms</label>
                        <input type="text" class="form-control" id="g-reg-prenom" required>
                      </div>
                      <div class="col-12">
                        <label class="form-label text-muted small fw-semibold">Email</label>
                        <input type="email" class="form-control" id="g-reg-email" required>
                      </div>
                      <div class="col-12">
                        <label class="form-label text-muted small fw-semibold">WhatsApp</label>
                        <div class="input-group">
                          <select class="form-select bg-white fw-bold text-secondary" id="g-reg-whatsapp-code" style="max-width: 110px;">
                            <option value="+228" selected>+228 Togo</option>
                            <option value="+225">+225 Côte d'Ivoire</option>
                            <option value="+223">+223 Mali</option>
                            <option value="+226">+226 Burkina Faso</option>
                            <option value="+227">+227 Niger</option>
                            <option value="+241">+241 Gabon</option>
                            <option value="+243">+243 RDC</option>
                            <option value="+242">+242 Congo</option>
                            <option value="+33">+33 France</option>
                            <option value="+1">+1 USA</option>
                          </select>
                          <input type="tel" class="form-control" id="g-reg-whatsapp" placeholder="90 00 00 00" required>
                        </div>
                      </div>
                      <div class="col-12">
                        <label class="form-label text-muted small fw-semibold">Mot de passe</label>
                        <input type="password" class="form-control" id="g-reg-password" required minlength="6">
                      </div>
                      <div class="col-12">
                        <div class="form-check mb-2 p-3 rounded-3" style="background-color: #f8faff; border: 1px solid #e7edf8;">
                          <input class="form-check-input" type="checkbox" id="g-reg-conditions" required>
                          <label class="form-check-label small text-dark" for="g-reg-conditions">
                            J'accepte les <a href="#" data-bs-toggle="modal" data-bs-target="#modalConditions" class="text-decoration-underline">Conditions Générales</a>
                            et la <a href="#" data-bs-toggle="modal" data-bs-target="#modalPolitique" class="text-decoration-underline">Politique de Confidentialité</a>
                            <span class="text-danger">*</span>
                          </label>
                        </div>
                      </div>
                      <div class="col-12">
                        <button type="submit" class="btn btn-primary w-100 py-2.5 fw-bold rounded-3">
                          <i class="fa-solid fa-user-plus me-1"></i> Créer mon compte
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', authModalHTML);

    const globalLoginForm = document.getElementById('global-login-form');
    if (globalLoginForm) {
      globalLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // TODO: Remplacer localStorage par Supabase plus tard
        localStorage.setItem('bide_auth_mode', 'user');
        bootstrap.Modal.getInstance(document.getElementById('authModal'))?.hide();
        alert('Connexion réussie ! Bienvenue.');
      });
    }

    const globalRegisterForm = document.getElementById('global-register-form');
    if (globalRegisterForm) {
      globalRegisterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Vérifier l'acceptation des conditions
        const gConditions = document.getElementById('g-reg-conditions');
        if (gConditions && !gConditions.checked) {
          alert('Vous devez accepter les Conditions Générales et la Politique de Confidentialité.');
          return;
        }
        // Construire le numéro complet
        const gPhoneCode = document.getElementById('g-reg-whatsapp-code');
        const gCodeVal = gPhoneCode ? gPhoneCode.value : '+228';
        const gPhoneVal = document.getElementById('g-reg-whatsapp').value;
        const newUser = {
          id: 'user_' + Date.now(),
          nom: document.getElementById('g-reg-nom').value,
          prenom: document.getElementById('g-reg-prenom').value,
          email: document.getElementById('g-reg-email').value,
          whatsapp: gCodeVal + gPhoneVal,
          whatsapp_code: gCodeVal,
          whatsapp_number: gPhoneVal
        };
        // TODO: Remplacer localStorage par Supabase plus tard
        const stored = localStorage.getItem('bide_users');
        const users = stored ? JSON.parse(stored) : [];
        if (users.find(u => u.email === newUser.email)) {
          alert('Un compte existe déjà avec cet email.');
          return;
        }
        users.push(newUser);
        localStorage.setItem('bide_users', JSON.stringify(users));
        localStorage.setItem('bide_current_user', JSON.stringify(newUser));
        localStorage.setItem('bide_auth_mode', 'user');
        bootstrap.Modal.getInstance(document.getElementById('authModal'))?.hide();
        alert('Compte créé avec succès ! Bienvenue ' + newUser.prenom + '.');
      });
    }
  }
});

// ============================================================
// SYSTÈME DE CODES PROMO — Validation et commission
// ============================================================
(function() {
  /**
   * Vérifie si un code promo est valide et retourne les informations
   * @param {string} code - Le code promo à vérifier
   * @returns {object|null} - Les infos du promo ou null si invalide
   */
  window.validatePromoCode = function(code) {
    if (!code) return null;
    const promos = JSON.parse(localStorage.getItem('bide_promo_demandes') || '[]');
    const promo = promos.find(p =>
      p.code === code.toUpperCase() &&
      p.status === 'approved' &&
      (!p.expires_at || new Date(p.expires_at) > new Date())
    );
    if (!promo) return null;
    return {
      code: promo.code,
      reduction: promo.admin_reduction || 10,
      commission: promo.admin_commission || 5,
      partner_nom: promo.nom,
      partner_id: promo.id,
      min_amount: promo.admin_min_amount || 0
    };
  };

  /**
   * Applique la réduction d'un code promo sur un montant
   * @param {number} amount - Le montant initial
   * @param {object} promoInfo - Les infos du promo (retourné par validatePromoCode)
   * @returns {object} - { discount, finalAmount, commissionAmount }
   */
  window.applyPromoDiscount = function(amount, promoInfo) {
    if (!promoInfo || amount <= 0) return { discount: 0, finalAmount: amount, commissionAmount: 0 };
    if (promoInfo.min_amount > 0 && amount < promoInfo.min_amount) {
      return { discount: 0, finalAmount: amount, commissionAmount: 0 };
    }
    const discount = Math.round(amount * promoInfo.reduction / 100);
    const finalAmount = amount - discount;
    const commissionAmount = Math.round(finalAmount * promoInfo.commission / 100);
    return { discount, finalAmount, commissionAmount };
  };

  /**
   * Enregistre l'utilisation d'un code promo et met à jour les stats du partenaire
   * @param {string} code - Le code promo utilisé
   * @param {number} orderTotal - Le montant total de la commande (après réduction)
   */
  window.recordPromoUsage = function(code, orderTotal) {
    if (!code) return;
    const promos = JSON.parse(localStorage.getItem('bide_promo_demandes') || '[]');
    const idx = promos.findIndex(p => p.code === code.toUpperCase());
    if (idx === -1) return;
    const promo = promos[idx];
    const commission = Math.round(orderTotal * (promo.admin_commission || 5) / 100);
    promos[idx].total_used = (promos[idx].total_used || 0) + 1;
    promos[idx].total_earned = (promos[idx].total_earned || 0) + commission;
    localStorage.setItem('bide_promo_demandes', JSON.stringify(promos));
  };

  /**
   * Applique le champ code promo dans un formulaire de paiement
   * @param {string} inputId - L'ID de l'input du code promo
   * @param {string} btnId - L'ID du bouton valider
   * @param {string} discountId - L'ID de l'élément qui affiche la réduction
   * @param {string} totalId - L'ID de l'élément qui affiche le total
   * @param {number} originalTotal - Le montant original
   */
  window.setupPromoInput = function(inputId, btnId, discountId, totalId, originalTotal) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const discountEl = document.getElementById(discountId);
    const totalEl = document.getElementById(totalId);
    if (!input || !btn) return;
    let appliedPromo = null;

    btn.addEventListener('click', function() {
      const code = input.value.trim().toUpperCase();
      if (!code) {
        alert('Veuillez saisir un code promo.');
        return;
      }
      const promoInfo = window.validatePromoCode(code);
      if (!promoInfo) {
        alert('Code promo invalide ou expiré.');
        appliedPromo = null;
        if (discountEl) discountEl.textContent = '0 FCFA';
        if (totalEl) totalEl.textContent = originalTotal.toLocaleString('fr-FR') + ' FCFA';
        return;
      }
      const result = window.applyPromoDiscount(originalTotal, promoInfo);
      appliedPromo = promoInfo;
      appliedPromo.result = result;
      if (discountEl) discountEl.textContent = '-' + result.discount.toLocaleString('fr-FR') + ' FCFA';
      if (totalEl) totalEl.textContent = result.finalAmount.toLocaleString('fr-FR') + ' FCFA';
      btn.innerHTML = '<i class="fa-solid fa-check text-success"></i> Code appliqué';
      btn.disabled = true;
      input.disabled = true;
    });

    // Retourner le promo appliqué (pour l'utiliser lors de la sauvegarde)
    window.getAppliedPromo = function() {
      return appliedPromo;
    };
  };
})();

//  js du  carroucel


document.addEventListener("DOMContentLoaded", function () {
  const heroCarousel = document.getElementById('heroCarousel');
  
  // Liste des classes d'animation
  const animations = [
    'anim-zoom',
    'anim-slide-right',
    'anim-slide-up',
    'anim-rotate'
  ];

  // Déclenché à chaque fois qu'une nouvelle slide va s'afficher
  heroCarousel.addEventListener('slide.bs.carousel', function (e) {
    const nextSlide = e.relatedTarget; // La slide qui va apparaître

    // 1. Nettoyer les anciennes animations sur toutes les slides
    heroCarousel.querySelectorAll('.carousel-item').forEach(item => {
      item.classList.remove(...animations);
    });

    // 2. Choisir une animation aléatoire
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];

    // 3. Appliquer l'animation à la nouvelle slide
    nextSlide.classList.add(randomAnim);
  });
});
