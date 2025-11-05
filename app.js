    const API_URL = "http://127.0.0.1:8000";
    let currentGameId = null;
    let isHost = false;
    let timerInterval;
    let myPlayerName = "";
    
    let gameStarted = false;
    
    let playersPollingInterval = setInterval(pollPlayersList, 3000);
    let currentTool = 'pencil';
    const eraserRadius = 20;
    const teamNames = {};

  
    function showToast(message, duration = 3000) {
      const div = document.createElement("div");
      div.className = "toast";
      div.innerText = message;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), duration);
    }

    async function startTimer(duration) {
      let timeLeft = duration;
      const timerDisplay = document.getElementById("timerDisplay");
      timerDisplay.innerText = `Timp rămas: ${timeLeft}s`;
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `Timp rămas: ${timeLeft}s`;
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
        }
      }, 1000);
    }

      // Funcție utilitară pentru a afișa o secțiune și a ascunde celelalte
    function showSection(id) {
      const sections = [
        "menuSection",
        "optionsSection",
        "newGameSection",
        "joinGameSection",
        "waitingRoomSection",
        "gameSection"
      ];
      sections.forEach(sec => {
        document.getElementById(sec).style.display = (sec === id) ? "block" : "none";
      });

      // Arată scoreboard-ul doar dacă secțiunea curentă este "gameSection"
      const sb = document.getElementById("scoreBoard");
      if (id === "gameSection") {
        sb.style.display = "flex";
      } else {
        sb.style.display = "none";
      }

      // Dezactivare/activare scroll
      if (id === "waitingRoomSection" || id === "gameSection") {
        document.body.classList.add("no-scroll");
      } else {
        document.body.classList.remove("no-scroll");
      }
    }
    
    // Apăsare buton Start - trece la opțiuni
    document.getElementById("startBtn").addEventListener("click", () => {
      showSection("optionsSection");
    });
    
    // Opțiunea "Creează joc nou" - se setează ca host și se afișează formularul de creare joc
    document.getElementById("newGameOptionBtn").addEventListener("click", () => {
      isHost = true;
      showSection("newGameSection");
    });
    
    // Opțiunea "Intră într-un joc existent" - se setează ca non-host și se afișează formularul de join
    document.getElementById("joinGameOptionBtn").addEventListener("click", () => {
      isHost = false;
      showSection("joinGameSection");
    });

    async function loadTeamNames() {
      const res = await fetch(`${API_URL}/api/games/${currentGameId}/teams`);
      if (!res.ok) throw new Error("Nu am găsit echipele");
      const teams = await res.json();   // presupunem un array [{id:1,name:"Alpha"},…]
      teams.forEach(t => { teamNames[t.id] = t.name; });
    }

    
    
    // Creare joc nou – host
    document.getElementById("createNewGameBtn").addEventListener("click", async () => {
      const gameName = document.getElementById("newGameName").value;
      const hostName = document.getElementById("hostName").value;
      if (!gameName || !hostName) {
        alert("Completați numele jocului și numele dvs.");
        return;
      }
      try {
        // Crează jocul
        const response = await fetch(API_URL + "/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: gameName })
        });
        if (response.ok) {
          const data = await response.json();
          currentGameId = data.gameId;
          // Actualizează Game ID în waiting room
          document.getElementById("gameIdInfo").innerText = "Game ID: " + currentGameId;
          
          // Adaugă host-ul automat ca jucător
          const addPlayerResponse = await fetch(API_URL + `/api/games/${currentGameId}/players`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: hostName })
          });
          if (addPlayerResponse.ok) {
            const playerData = await addPlayerResponse.json();
            myPlayerId = playerData.playerId;

            // Pornește conexiunea WebSocket pentru update-uri în timp real
            connectWebSocket(currentGameId);
            showSection("waitingRoomSection");
            if (isHost) {
              document.getElementById("teamAssignmentSection").style.display = "block";
              document.getElementById("createTeamSection").style.display = "block";
            }
          } else {
            alert("Eroare la adăugarea host-ului ca jucător!");
          }
        } else {
          alert("Eroare la crearea jocului!");
        }
      } catch (error) {
        console.error("Eroare:", error);
      }
    });

    
    // Join joc existent – se efectuează acum și verificarea numărului de jucători
    document.getElementById("joinGameBtn").addEventListener("click", async () => {
      const gameId = document.getElementById("joinGameId").value;
      const playerName = document.getElementById("joinPlayerName").value;
      if (!gameId || !playerName) {
        alert("Completați Game ID-ul și numele dvs.");
        return;
      }
      try {
        // Verifică dacă jocul este deja plin
        const playersResponse = await fetch(API_URL + `/api/games/${gameId}/players`);
        if (playersResponse.ok) {
          const data = await playersResponse.json();
          if (data.players.length >= 4) {
            alert("această camera de joc este deja plină");
            return;
          }
        }
        currentGameId = gameId;
        // Actualizează Game ID în waiting room
        document.getElementById("gameIdInfo").innerText = "Game ID: " + currentGameId;
        
        const addPlayerResponse = await fetch(API_URL + `/api/games/${currentGameId}/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: playerName })
        });
        if (addPlayerResponse.ok) {
          const playerData = await addPlayerResponse.json();
          myPlayerId = playerData.playerId;

          connectWebSocket(currentGameId);
          showSection("waitingRoomSection");
        } else {
          alert("Eroare la intrarea în joc!");
        }
      } catch (error) {
        console.error("Eroare:", error);
      }
    });

    document.getElementById("playersList").addEventListener("click", async e => {
      if (!e.target.classList.contains("btnKick")) return;
      const li = e.target.closest("li");
      const pid = li.dataset.playerId;
      if (!confirm(`Sunteți sigur că vreți să eliminați jucătorul ${pid}?`)) return;
      try {
        const res = await fetch(`/api/players/${pid}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).detail);
        li.remove();
      } catch (err) {
        alert("Eroare la kick: " + err.message);
      }
    });

    function updateScoreBoard() {
      if (!currentGameId) return;
      fetch(`${API_URL}/api/games/${currentGameId}/players`)
        .then(resp => resp.json())
        .then(({ players }) => {
          const t1 = players.filter(p => p.teamId === 1).reduce((s,p)=>s+p.score,0);
          const t2 = players.filter(p => p.teamId === 2).reduce((s,p)=>s+p.score,0);
          const name1 = teamNames[1] || "Echipa 1";
          const name2 = teamNames[2] || "Echipa 2";
          document.getElementById("team1Score").innerText = `${name1}: ${t1}p`;
          document.getElementById("team2Score").innerText = `${name2}: ${t2}p`;
        })
        .catch(console.error);
    }
    
    // Funcție pentru conectarea WebSocket
    function connectWebSocket(gameId) {
      ws = new WebSocket(`ws://127.0.0.1:8000/ws/${gameId}`);

      ws.onopen = () => console.log("WebSocket connected");

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          if (event.data.includes("start_game")) {
            msg = { type: "start_game" };
          }
        }
        if (!msg) return;

        if (msg.type === "players_update") {
          updatePlayersList(msg.players);

        } else if (msg.type === "start_game") {
          gameStarted = true;
          clearInterval(playersPollingInterval);
          showSection("gameSection");
          startTimer(90);
          updateScoreBoard();


        } else if (msg.type === "new_turn") {
          const action = msg.roundType === "draw" ? "deseneze" : "descrie";
          const turnText = `${msg.playerName} ${msg.playerId} trebuie să ${action} un cuvânt`;
          document.getElementById("gameInfo").innerText =
            (msg.playerId === myPlayerId)
              ? `${turnText} (${msg.word})`
              : turnText;

        } else if (msg.type === "chat") {
          document.getElementById("chatBox").innerHTML +=
            `<p><strong>${msg.playerName}:</strong> ${msg.text}</p>`;

        } else if (msg.type === "drawing") {
          // afișăm desenul fără a șterge canvas-ul
          const display = document.getElementById("drawingDisplay")
            || (() => {
                const d = document.createElement("div");
                d.id = "drawingDisplay";
                document.getElementById("drawingCanvasContainer")
                        .appendChild(d);
                return d;
              })();
          display.innerHTML =
            `<img src="${msg.drawingData}" width="400" height="300">`;

        } else if (msg.type === "guess_result") {
          // afișăm cine a ghicit și ce a scris, plus corect/gresit
          const line = msg.correct
            ? `✔️ ${msg.playerName}: ${msg.guess}`
            : `❌ ${msg.playerName}: ${msg.guess}`;
          document.getElementById("chatBox").innerHTML += `<p>${line}</p>`;
          if (msg.correct) {
            updateScoreBoard();
          }

        } else if (msg.type === "end_turn") {
          // reset canvas și desen afișat
          drawingCtx.clearRect(0, 0,
            drawingCanvas.width, drawingCanvas.height);
          const disp = document.getElementById("drawingDisplay");
          if (disp) disp.innerHTML = "";

          // logică final de tură
          clearInterval(timerInterval);
          updateScoreBoard();
          startTimer(90);
          if (isHost) startRound();

        } else if (msg.type === "score_update") {
          updateScoreBoard();
        }
      };

      ws.onclose  = () => console.log("WebSocket closed");
      ws.onerror  = err => console.error("WS error", err);
    }



    let myPlayerId = null;
    let isDrawer = false;
    let ws;

    function startWebSocket(gameId) {
      ws = new WebSocket(`ws://127.0.0.1:8000/ws/${gameId}`);
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'guess_result') {
          const line = msg.correct ? `✔️ Răspuns corect! Player ${msg.playerId}` : `❌ Greșit! Player ${msg.playerId}`;
          document.getElementById("chatBox").innerHTML += `<p>${line}</p>`;
        }
        if (msg.type === 'end_turn') {
          alert("Tura s-a încheiat.");
        }
      }
    }

    function sendChat() {
      const input = document.getElementById("chatInput");
      if (ws && ws.readyState === WebSocket.OPEN && input.value.trim()) {
        ws.send(JSON.stringify({
          type: "chat",
          playerId: myPlayerId,
          playerName: myPlayerName,
          text: input.value.trim()
        }));
        input.value = "";
      }
    }

    // conectăm butonul:
    document
      .getElementById("sendGuessBtn")
      .addEventListener("click", sendGuess);

    document.getElementById("showDrawingBtn")
            .addEventListener("click", () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const canvas = document.getElementById("drawingCanvas");
        const drawingData = canvas.toDataURL();
        ws.send(JSON.stringify({
          type: "drawing",
          playerId: myPlayerId,
          drawingData
        }));
      }
    });        

    function sendGuess() {
      const input = document.getElementById("chatInput");
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "guess", guess: input.value, playerId: myPlayerId }));
        input.value = "";
      }
    }

    function endTurn() {
      alert("Ai trimis tura!");
    }

    async function startRound() {
      if (!currentGameId || !myPlayerId) return;
      const response = await fetch(`${API_URL}/api/games/${currentGameId}/start_turn`, { method: 'POST' });
      const data = await response.json();

      document.getElementById("gameInfo").innerText =
        data.roundType === "draw" && data.playerId === myPlayerId
          ? `🎨 Desenează: ${data.word}`
          : data.roundType === "describe" && data.playerId === myPlayerId
          ? `📝 Descrie: ${data.word}`
          : `👀 Așteptăm răspunsuri...`;

      // Notificare non-blocking
      if (data.playerId === myPlayerId) {
        showToast(`E rândul tău! Cuvânt: ${data.word}`);
      } else {
        showToast(`Rândul jucătorului ${data.playerId}`);
      }

      isDrawer = data.playerId === myPlayerId;
    }

    // Poți apela asta după login/join pentru a seta ID-urile necesare
    function setupGameSession(gameId, playerId) {
      currentGameId = gameId;
      myPlayerId = playerId;
      startWebSocket(gameId);
    }
    
    // Funcție pentru actualizarea listei de jucători în waiting room
    function updatePlayersList(players) {
      if (gameStarted) return; // Nu actualizăm dacă jocul a început
      const playersListUl = document.getElementById("playersList");
      playersListUl.innerHTML = "";
      players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `ID: ${player.id}, Nume: ${player.name}` + (player.teamId ? `, Echipa: ${player.teamId}` : "");
        playersListUl.appendChild(li);
      });
      // Actualizează mesajul din waiting room
      if (players.length >= 4) {
        document.getElementById("waitingMessage").innerText = "Toți jucătorii s-au alăturat. Așteptăm formarea echipelor.";
      } else {
        document.getElementById("waitingMessage").innerText = `Așteptăm ${4 - players.length} jucător(i) să se alăture...`;
      }
      // Pentru host: dacă sunt 4 jucători și fiecare are un teamId, afișează butonul "Start Joc"
      if (isHost) {
        if (players.length === 4 && players.every(p => p.teamId)) {
          document.getElementById("startGameBtn").style.display = "block";
        } else {
          document.getElementById("startGameBtn").style.display = "none";
        }
      }
    }
    
    // Funcție de polling pentru a prelua periodic lista de jucători
    async function pollPlayersList() {
      if (!currentGameId || gameStarted) return;
      try {
        const response = await fetch(API_URL + `/api/games/${currentGameId}/players`);
        if (response.ok) {
          const data = await response.json();
          updatePlayersList(data.players);
        }
      } catch (error) {
        console.error("Eroare la poll players:", error);
      }
    }
    
    // Funcționalitatea de creare a unei echipe (doar pentru host)
    document.getElementById("createTeamBtn").addEventListener("click", async () => {
      const teamName = document.getElementById("teamName").value;
      if (!teamName) {
        alert("Introduceți numele echipei!");
        return;
      }
      try {
        const response = await fetch(API_URL + `/api/games/${currentGameId}/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: teamName })
        });
        if (response.ok) {
          const data = await response.json();
          document.getElementById("createdTeamInfo").innerText =
            `Echipă creată: ID ${data.teamId}, Nume: ${teamName}`;
          // Salvează în hartă:
          teamNames[data.teamId] = teamName;
          // Afișează dintr-odată noile etichete de pe scoreboard:
          updateScoreBoard();
        } else {
          alert("Eroare la crearea echipei!");
        }
      } catch (error) {
        console.error("Eroare:", error);
      }
    });
    
    // Funcționalitate de asignare a unui jucător la o echipă (doar pentru host)
    document.getElementById("assignPlayerBtn").addEventListener("click", async () => {
      const playerId = parseInt(document.getElementById("assignPlayerId").value);
      const teamId = parseInt(document.getElementById("assignTeamId").value);
      if (isNaN(playerId) || isNaN(teamId)) {
        alert("Introduceți ID-uri numerice valide!");
        return;
      }
      try {
        const response = await fetch(API_URL + `/api/games/${currentGameId}/assign_player`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, teamId })
        });
        if (response.ok) {
          alert("Jucătorul a fost asignat echipei cu succes.");
        } else {
          alert("Eroare la asignarea jucătorului.");
        }
      } catch (error) {
        console.error("Eroare:", error);
      }
    });

    // Swap Teams (doar host)
    document.getElementById("btnSwap").addEventListener("click", async () => {
      const A = parseInt(document.getElementById("swapA").value, 10);
      const B = parseInt(document.getElementById("swapB").value, 10);
      if (isNaN(A) || isNaN(B)) {
        return alert("Introduceți ID-uri numerice valide pentru ambii jucători!");
      }
      try {
        const res = await fetch(`${API_URL}/api/games/${currentGameId}/swap_teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerA: A, playerB: B }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail || body.message);
        alert(`Swap reușit: ${body.message}`);
        // Reîmprospătăm lista de jucători/echipe
        pollPlayersList();
      } catch (err) {
        alert("Eroare: " + err.message);
      }
    });

        // Funcționalitatea de „unassign” (doar pentru host)
    document.getElementById("btnUnassign").addEventListener("click", async () => {
      const playerId = parseInt(document.getElementById("unassignPlayerId").value);
      if (isNaN(playerId)) {
        return alert("Trebuie un playerId valid");
      }
      try {
        const res = await fetch(`${API_URL}/api/games/${currentGameId}/players/${playerId}/team`, {
          method: "DELETE",
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.detail || body.message);
        }
        alert(body.message);
        // Reîmprospătăm lista de jucători/echipe
        pollPlayersList();
      } catch (err) {
        alert("Eroare: " + err.message);
      }
    });

    
    // Eveniment pentru butonul de Start Joc (doar pentru host)
    document.getElementById("startGameBtn").addEventListener("click", async () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "start_game" }));
      }
      gameStarted = true;
      clearInterval(playersPollingInterval);
      showSection("gameSection");
      startTimer(90);
      // Host-ul pornește runda întâi
      if (isHost) {
        await startRound();
      }
    });

    
    // Funcționalitatea pentru UI-ul din secțiunea de joc – exemplu pentru tablă și desen
    const drawingCanvas = document.getElementById("drawingCanvas");
    const drawingCtx = drawingCanvas.getContext("2d");
    let drawing = false;
    function getCurrentStyle() {
      // Se pot adăuga opțiuni suplimentare pentru culoare și grosime
      return { color: "#000000", lineWidth: 2 };
    }
    drawingCanvas.addEventListener("mousedown", (e) => {
      drawing = true;
      const { color, lineWidth } = getCurrentStyle();
      drawingCtx.strokeStyle = color;
      drawingCtx.lineWidth = lineWidth;
      drawingCtx.beginPath();
      drawingCtx.moveTo(e.offsetX, e.offsetY);
    });
    drawingCanvas.addEventListener("mousemove", (e) => {
      if (drawing) {
        drawingCtx.lineTo(e.offsetX, e.offsetY);
        drawingCtx.stroke();
      }
    });
    drawingCanvas.addEventListener("mouseup", () => { drawing = false; });
    drawingCanvas.addEventListener("mouseleave", () => { drawing = false; });

    document.getElementById("btnClearDrawing").addEventListener("click", async () => {
      // 1. Golește imediat canvas-ul local
      drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

      // 2. Încearcă să ștergi și în backend, dar ignoră 404
      try {
        const res = await fetch(`${API_URL}/api/drawings/${currentGameId}`, {
          method: "DELETE"
        });
        if (!res.ok && res.status !== 404) {
          const err = await res.json();
          throw new Error(err.detail || err.message);
        }
      } catch (err) {
        console.warn("Ștergere backend eșuată:", err.message);
      }
    });

    document.getElementById('btnPencil').addEventListener('click', () => {
      currentTool = 'pencil';
      drawingCtx.globalCompositeOperation = 'source-over';  // desen normal
      drawingCtx.lineWidth = 2;
      drawingCtx.strokeStyle = '#000';
    });

    document.getElementById('btnEraser').addEventListener('click', () => {
      currentTool = 'eraser';
      drawingCtx.globalCompositeOperation = 'destination-out';  // ștergere
      drawingCtx.lineWidth = eraserRadius * 2;
    });

    // 3. Funcție utilitară pentru poziția mouse-ului în canvas
    function getMousePos(evt) {
      const rect = drawingCanvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    // 4. Mouse events pentru desen/șters
    let isDrawing = false;

    drawingCanvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const { x, y } = getMousePos(e);
      drawingCtx.beginPath();
      drawingCtx.moveTo(x, y);
      // Dacă e gumă, facem un mic cerc initial
      if (currentTool === 'eraser') {
        drawingCtx.lineTo(x, y);
        drawingCtx.stroke();
      }
    });

    drawingCanvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const { x, y } = getMousePos(e);
      if (currentTool === 'eraser') {

        drawingCtx.lineTo(x, y);
        drawingCtx.stroke();
      } else {
        drawingCtx.lineTo(x, y);
        drawingCtx.stroke();
      }
    });

    ['mouseup', 'mouseleave'].forEach(evt =>
      drawingCanvas.addEventListener(evt, () => {
        isDrawing = false;
      })
    );
