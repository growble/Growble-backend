document.getElementById("signupBtn").addEventListener("click", async () => {
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const signupBtn = document.getElementById("signupBtn");

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = passEl.value;

  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toastTitle");
  const toastMsg = document.getElementById("toastMsg");
  const toastOkBtn = document.getElementById("toastOkBtn");
  const toastIcon = document.getElementById("toastIcon");

  let redirectTimer = null;

  function setLoading(isLoading){
    if(isLoading){
      signupBtn.disabled = true;
      signupBtn.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span class="spinner"></span>
          Creating...
        </span>
      `;
    }else{
      signupBtn.disabled = false;
      signupBtn.innerHTML = "Signup";
    }
  }

  function showToast({type="success", title="", msg="", redirectUrl=null}){
    if(redirectTimer) clearTimeout(redirectTimer);

    toast.classList.remove("hidden","toast-success","toast-error","toast-shake");

    if(type==="success"){
      toast.classList.add("toast-success");
      toastIcon.textContent="✅";
    }else{
      toast.classList.add("toast-error","toast-shake");
      toastIcon.textContent="❌";
    }

    toastTitle.textContent = title;
    toastMsg.textContent = msg;

    toast.classList.remove("hidden");

    toastOkBtn.onclick = ()=>{
      toast.classList.add("hidden");
      if(redirectUrl) window.location.href = redirectUrl;
    };

    if(redirectUrl){
      redirectTimer = setTimeout(()=>{
        toast.classList.add("hidden");
        window.location.href = redirectUrl;
      },3500);
    }
  }

  if(!name || !email || !password){
    showToast({
      type:"error",
      title:"Missing Details",
      msg:"All fields are required."
    });
    return;
  }

  try{
    setLoading(true);

    const res = await fetch("/api/auth/signup",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,email,password})
    });

    const data = await res.json();

    if(!res.ok){
      showToast({
        type:"error",
        title:"Signup Failed",
        msg:data.message || "Signup failed."
      });
      return;
    }

    // if backend sends token
    if(data.token){
      localStorage.setItem("token", data.token);
      showToast({
        type:"success",
        title:"Account Created 🎉",
        msg:"Welcome to Growble!",
        redirectUrl:"/dashboard.html"
      });
      return;
    }

    // if no token
    showToast({
      type:"success",
      title:"Signup Successful 🎉",
      msg:"Please login to continue.",
      redirectUrl:"/login.html"
    });

  }catch(err){
    console.error(err);
    showToast({
      type:"error",
      title:"Server Error",
      msg:"Something went wrong."
    });
  }finally{
    setLoading(false);
  }
});
// Show / Hide Password
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "🙈" : "👁";
  });
}