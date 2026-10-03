--[[
	Installateur SCP – Containment Breach pour Roblox Studio.

	Utilisation : dans Studio, Voir > Barre de commande, colle tout ce fichier puis clique sur le bouton
	« Exécuter » (dans la nouvelle barre de commande, Entrée ajoute seulement une ligne).
	Les messages s'affichent dans Voir > Sortie.

	Il télécharge le code du projet depuis GitHub (sans Rojo), l'installe dans
	ReplicatedStorage.Shared, ServerScriptService.Server et ServerStorage.SCPTools,
	règle l'éclairage, active la galerie de test et prépare les modèles déjà importés.
	On peut le relancer pour mettre à jour : il remplace seulement ce qu'il a installé lui-même.

	Ce fichier n'utilise que des commentaires en bloc : la barre de commande met souvent le texte
	collé sur une seule ligne, et un commentaire de fin de ligne avalerait tout le reste du script.
]]

local OWNER = "treyeinhorn1234-ctrl"
local REPO = "test"
local BRANCH = "claude/tender-galileo-b486o2"
local BASE = `https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/scp-roblox/`

local HttpService = game:GetService("HttpService")
local Lighting = game:GetService("Lighting")

local ROOTS = {
	["src/shared"] = { service = game:GetService("ReplicatedStorage"), name = "Shared" },
	["src/server"] = { service = game:GetService("ServerScriptService"), name = "Server" },
	["src/studio"] = { service = game:GetService("ServerStorage"), name = "SCPTools" },
}
local MARK = "SCPInstaller"

local function log(msg: string)
	print("[SCP] " .. msg)
end

log("Installateur démarré. Les messages s'affichent dans la fenêtre Sortie (Voir > Sortie).")

--[[ 1. Accès HTTP (nécessaire pour lire GitHub ; réglage du jeu, modifiable dans Paramètres du jeu > Sécurité) ]]
HttpService.HttpEnabled = true

local function fetch(path: string): string
	local url = BASE .. path
	for attempt = 1, 4 do
		local ok, result = pcall(HttpService.GetAsync, HttpService, url, true)
		if ok then
			return result
		end
		if attempt == 4 then
			error(`Téléchargement impossible : {url}\n{result}`)
		end
		task.wait(attempt)
	end
	return ""
end

--[[ 2. Liste des fichiers ]]
log("Lecture de la liste des fichiers…")
local files = {}
for line in string.gmatch(fetch("manifest.txt"), "[^\r\n]+") do
	table.insert(files, line)
end
log(`{#files} scripts à installer.`)

--[[ Les dossiers qui contiennent un init.luau deviennent des ModuleScripts (convention Rojo) ]]
local moduleDirs = {}
for _, path in files do
	local dir = string.match(path, "^(.*)/init%.luau$")
	if dir then
		moduleDirs[dir] = true
	end
end

--[[ 3. Racines : on ne remplacera que ce que l'installateur a créé lui-même ]]
local rootInstances = {}
for prefix, root in ROOTS do
	local existing = root.service:FindFirstChild(root.name)
	if existing and not existing:GetAttribute(MARK) then
		error(`{root.service.Name}.{root.name} existe déjà et n'a pas été créé par l'installateur (Rojo ?). Supprime-le ou renomme-le, puis relance.`)
	end
	local inst = Instance.new("Folder")
	inst.Name = root.name
	inst:SetAttribute(MARK, true)
	rootInstances[prefix] = inst
end

local created: { [string]: Instance } = {}

local function container(path: string): Instance
	--[[ path : chemin d'un dossier, ex. "src/server/Generated/RoomColliders/lockroom" ]]
	if created[path] then
		return created[path]
	end
	if rootInstances[path] then
		return rootInstances[path]
	end
	local parentPath, name = string.match(path, "^(.*)/([^/]+)$")
	local parent = container(parentPath)
	local inst = Instance.new(if moduleDirs[path] then "ModuleScript" else "Folder")
	inst.Name = name
	inst.Parent = parent
	created[path] = inst
	return inst
end

local function install(path: string, source: string)
	local dir, file = string.match(path, "^(.*)/([^/]+)$")
	if file == "init.luau" then
		(container(dir) :: ModuleScript).Source = source
		return
	end
	local base = string.gsub(file, "%.luau$", "")
	local class = "ModuleScript"
	if string.match(base, "%.server$") then
		class, base = "Script", string.gsub(base, "%.server$", "")
	elseif string.match(base, "%.client$") then
		class, base = "LocalScript", string.gsub(base, "%.client$", "")
	end
	local inst = Instance.new(class) :: any
	inst.Name = base
	inst.Source = source
	inst.Parent = container(dir)
end

--[[ 4. Téléchargement (plusieurs à la fois) puis création des scripts ]]
log("Téléchargement depuis GitHub…")
local sources: { [string]: string } = {}
local nextIndex, done, failure = 1, 0, nil
local WORKERS = 8
local finished = 0
for _ = 1, WORKERS do
	task.spawn(function()
		while not failure and nextIndex <= #files do
			local path = files[nextIndex]
			nextIndex += 1
			local ok, result = pcall(fetch, path)
			if ok then
				sources[path] = result
				done += 1
				if done % 25 == 0 then
					log(`  {done}/{#files}`)
				end
			else
				failure = result
			end
		end
		finished += 1
	end)
end
while finished < WORKERS do
	task.wait(0.1)
end
if failure then
	error(failure)
end

for _, path in files do
	install(path, sources[path])
end
--[[ Tout est téléchargé : on remplace l'ancienne installation seulement maintenant ]]
for prefix, inst in rootInstances do
	local root = ROOTS[prefix]
	local old = root.service:FindFirstChild(root.name)
	if old then
		old:Destroy()
	end
	inst.Parent = root.service
end
log("Code installé.")

--[[ 5. Réglages pour tester ]]
workspace:SetAttribute("SCP_RoomGallery", true)
log("Galerie de test activée (attribut SCP_RoomGallery de Workspace).")
--[[ Roblox interdit à la barre de commande de changer Lighting.Technology : on le signale seulement ]]
if Lighting.Technology ~= Enum.Technology.Future then
	log("À faire à la main : clique sur Lighting dans l'Explorer, puis mets Technology sur Future dans les Propriétés.")
end

--[[ 6. Préparation des modèles déjà importés ]]
local count = require(rootInstances["src/studio"]:WaitForChild("PrepareAssets"))()

if count.Rooms == 0 then
	log("Il reste à importer les salles : Accueil > Importer 3D, puis un .obj de build/rooms/<salle>/.")
	log("Ensuite, relance la préparation : require(game.ServerStorage.SCPTools.PrepareAssets)()")
else
	log("Prêt ! Appuie sur Jouer pour voir la galerie des salles.")
end
