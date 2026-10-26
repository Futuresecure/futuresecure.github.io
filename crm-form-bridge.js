/* Future Secure Providers - Website Form -> CRM Bridge
   Keeps existing form UI/HTML unchanged and only adds CRM lead creation.
*/
(function () {
  var SUPABASE_URL = "https://cjwxirpwzluynymwjzxl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_jkr9U6yu6ODDa4JvHmrE4w_gIWJBsOz";

  function getSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-fsp-supabase-sdk="1"]');
      if (existing) {
        existing.addEventListener("load", function () {
          if (window.supabase && window.supabase.createClient) resolve(window.supabase);
          else reject(new Error("Supabase SDK not available"));
        }, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Failed to load Supabase SDK")); }, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.setAttribute("data-fsp-supabase-sdk", "1");
      script.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve(window.supabase);
        else reject(new Error("Supabase SDK not available"));
      };
      script.onerror = function () { reject(new Error("Failed to load Supabase SDK")); };
      document.head.appendChild(script);
    });
  }

  function cleanMobile(value) {
    var mobile = String(value || "").replace(/\D/g, "");
    if (mobile.length === 12 && mobile.indexOf("91") === 0) mobile = mobile.slice(2);
    if (mobile.length === 11 && mobile.charAt(0) === "0") mobile = mobile.slice(1);
    return mobile;
  }

  function sourceFromSession() {
    var source = "";
    try { source = sessionStorage.getItem("fsp_utm_source") || ""; } catch (e) {}
    return source === "MetaAds" ? "Meta Ads" : "Website";
  }

  window.saveFspLead = async function (payload) {
    payload = payload || {};
    var fullName = String(payload.full_name || "").trim();
    var mobile = cleanMobile(payload.mobile_number);

    if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile)) {
      return { success: false, error: "Invalid name or mobile number" };
    }

    try {
      var supabase = await getSupabase();
      var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      // Enquiry-level deduplication belongs to the server RPC, not a mobile-only lookup.

      var notes = String(payload.notes || "").trim();
      var product = String(payload.product || "").trim();
      if (product) notes = notes ? "Product: " + product + " | " + notes : "Product: " + product;

      var rpc = await client.rpc("handle_website_lead_creation", {
        p_full_name: fullName,
        p_mobile_number: mobile,
        p_city: payload.city ? String(payload.city).trim() : null,
        p_lead_source: payload.lead_source || sourceFromSession(),
        p_pincode: payload.pincode ? String(payload.pincode).trim() : null,
        p_family_members: payload.family_members ? String(payload.family_members) : null,
        p_medical_info: payload.medical_info ? String(payload.medical_info) : "இல்லை",
        p_notes: notes || null
      });

      if (rpc.error) throw rpc.error;
      if (!rpc.data || !rpc.data.success) throw new Error("Lead creation failed");

      return {
        success: true,
        duplicate: !!rpc.data.duplicate,
        lead_id: rpc.data.lead_id,
        full_name: fullName,
        mobile_number: mobile
      };
    } catch (error) {
      console.error("FSP CRM lead save failed:", error);
      return { success: false, error: error && error.message ? error.message : String(error) };
    }
  };
})();
