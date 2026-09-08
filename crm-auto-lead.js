(function () {
  // ============================================================================
  // PRODUCTION VERSION - crm-auto-lead.js (RPC implementation)
  // ============================================================================
  // This version calls handle_website_lead_creation RPC function
  // No diagnostic mode, clean for production
  
  var SUPABASE_URL = "https://cjwxirpwzluynymwjzxl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_jkr9U6yu6ODDa4JvHmrE4w_gIWJBsOz";

  // ============================================================================
  // GET SUPABASE SDK
  // ============================================================================
  function getSupabase() {
    if (window.supabase && window.supabase.createClient) {
      return Promise.resolve(window.supabase);
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      
      var loadTimeout = setTimeout(function() {
        reject(new Error("Script loading timeout"));
      }, 5000);

      script.onload = function () {
        clearTimeout(loadTimeout);
        if (window.supabase && window.supabase.createClient) {
          resolve(window.supabase);
        } else {
          reject(new Error("Supabase SDK not available"));
        }
      };

      script.onerror = function() {
        clearTimeout(loadTimeout);
        reject(new Error("Failed to load Supabase SDK"));
      };

      document.head.appendChild(script);
    });
  }

  // ============================================================================
  // CLEAN MOBILE FUNCTION
  // ============================================================================
  function cleanMobile(value) {
    var mobile = String(value || "").replace(/\D/g, "");
    if (mobile.length === 12 && mobile.indexOf("91") === 0) mobile = mobile.slice(2);
    if (mobile.length === 11 && mobile.charAt(0) === "0") mobile = mobile.slice(1);
    return mobile;
  }

  // ============================================================================
  // MAIN SAVE WEBSITE LEAD FUNCTION
  // ============================================================================
  async function saveWebsiteLead() {
    try {
      // Get form fields
      var nameEl = document.getElementById("fspName");
      var phoneEl = document.getElementById("fspPhone");

      if (!nameEl || !phoneEl) {
        return { success: false, error: "Form fields not found" };
      }

      // Collect form data
      var fullName = nameEl.value.trim();
      var mobile = cleanMobile(phoneEl.value);

      // Validate form data
      if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile)) {
        return { success: false, error: "Invalid name or mobile number" };
      }

      // Collect additional fields
      var pincodeEl = document.getElementById("fspPincode");
      var pincode = pincodeEl ? pincodeEl.value.trim() : "";

      var members = [];
      document.querySelectorAll("#fspAges .fsp-age").forEach(function(i) {
        members.push(i.getAttribute("data-label") + " (" + (i.value || "?") + ")");
      });
      var membersStr = members.join(", ");

      var med = [];
      document.querySelectorAll("#fspMedical input:checked").forEach(function(i) {
        med.push(i.value);
      });
      var medStr = med.length ? med.join(", ") : "இல்லை";

      var us = sessionStorage.getItem("fsp_utm_source") || "";
      var leadSource = us === "MetaAds" ? "Meta Ads" : "Website";

      var notes = [];
      if (membersStr) notes.push("Family: " + membersStr);
      if (pincode) notes.push("Pincode: " + pincode);
      if (medStr && medStr !== "இல்லை") notes.push("Medical: " + medStr);
      var notesStr = notes.join(" | ");

      // Get Supabase SDK
      var supabase = await getSupabase();

      // Create client
      var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      // Duplicate check
      var existing = await client
        .from("leads")
        .select("id")
        .eq("mobile_number", mobile)
        .limit(1);

      if (existing.error) {
        return { success: false, error: "Duplicate check failed: " + existing.error.message };
      }

      if (existing.data && existing.data.length > 0) {
        return {
          success: true,
          duplicate: true,
          lead_id: existing.data[0].id,
          message: "Lead already exists"
        };
      }

      // Call RPC function
      var rpcResult = await client.rpc('handle_website_lead_creation', {
        p_full_name: fullName,
        p_mobile_number: mobile,
        p_city: pincode ? "Pincode: " + pincode : null,
        p_lead_source: leadSource,
        p_pincode: pincode,
        p_family_members: membersStr,
        p_medical_info: medStr,
        p_notes: notesStr
      });

      if (rpcResult.error) {
        return { success: false, error: "RPC call failed: " + rpcResult.error.message };
      }

      var responseData = rpcResult.data;
      if (!responseData || !responseData.success) {
        return { success: false, error: "Lead creation failed" };
      }

      return {
        success: true,
        lead_id: responseData.lead_id,
        full_name: fullName,
        mobile_number: mobile
      };

    } catch (err) {
      return { success: false, error: "Error: " + err.message };
    }
  }

  // ============================================================================
  // EXPOSE FUNCTION TO GLOBAL SCOPE
  // ============================================================================
  window.saveWebsiteLead = saveWebsiteLead;
})();
