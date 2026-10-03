-- Préparation des modèles importés, à lancer dans Studio depuis la barre de commande
-- (Affichage > Barre de commande), après avoir importé les .obj des salles et des props :
--
--     require(game.ServerStorage.SCPTools.PrepareAssets)()
--
-- L'installateur (tools/studio/Install.luau) le lance aussi automatiquement.
--
-- Le script :
--   1. retrouve dans Workspace les modèles importés (par leur nom de fichier) ;
--   2. corrige leur échelle si l'importateur l'a changée ;
--   3. place leur pivot sur l'origine de la salle ou du prop du jeu d'origine ;
--   4. règle les propriétés des MeshParts (ancrage, collisions) ;
--   5. les range dans ServerStorage.SCPAssets.Rooms et ServerStorage.SCPAssets.Props.
--
-- On peut le relancer sans risque après chaque nouvel import.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

return function()
	-- Toujours relire les données : require() garde le premier résultat en cache
	local source = ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Generated"):WaitForChild("RoomTemplates")
	local data = require(source:Clone())

	local function folder(parent: Instance, name: string): Instance
		local f = parent:FindFirstChild(name)
		if not f then
			f = Instance.new("Folder")
			f.Name = name
			f.Parent = parent
		end
		return f
	end

	local root = folder(ServerStorage, "SCPAssets")
	local roomsFolder = folder(root, "Rooms")
	local propsFolder = folder(root, "Props")

	-- Boîte englobante attendue (en studs, repère du fichier) pour chaque nom de modèle
	local expected = {}
	for _, room in data.rooms do
		expected[room.asset] = { kind = "Rooms", min = room.boundsMin, max = room.boundsMax }
	end
	for name, prop in data.props do
		expected[name] = { kind = "Props", min = prop.boundsMin, max = prop.boundsMax }
	end

	local function worldBounds(model: Model): (Vector3, Vector3)
		local lo = Vector3.new(math.huge, math.huge, math.huge)
		local hi = -lo
		for _, part in model:GetDescendants() do
			if part:IsA("BasePart") then
				local half = part.Size / 2
				for _, sx in { -1, 1 } do
					for _, sy in { -1, 1 } do
						for _, sz in { -1, 1 } do
							local p = part.CFrame:PointToWorldSpace(half * Vector3.new(sx, sy, sz))
							lo = lo:Min(p)
							hi = hi:Max(p)
						end
					end
				end
			end
		end
		return lo, hi
	end

	local function prepare(model: Model, info)
		local expMin = Vector3.new(table.unpack(info.min))
		local expMax = Vector3.new(table.unpack(info.max))
		local expSize = expMax - expMin

		local lo, hi = worldBounds(model)
		local ratio = expSize.Magnitude / math.max((hi - lo).Magnitude, 1e-6)
		if math.abs(ratio - 1) > 0.02 then
			print(`  {model.Name} : échelle corrigée (x{string.format("%.3f", ratio)})`)
			model:ScaleTo(model:GetScale() * ratio)
			lo, hi = worldBounds(model)
		end

		-- Origine du fichier = centre mesuré - centre attendu
		local origin = (lo + hi) / 2 - (expMin + expMax) / 2
		model.WorldPivot = CFrame.new(origin)

		local isRoom = info.kind == "Rooms"
		for _, part in model:GetDescendants() do
			if part:IsA("MeshPart") then
				part.Anchored = true
				part.CanTouch = false
				if isRoom then
					-- Les salles collisionnent par des boîtes générées (voir RoomBuilder)
					part.CanCollide = false
					part.CanQuery = false
					part.CollisionFidelity = Enum.CollisionFidelity.Box
				else
					part.CanCollide = true
					part.CanQuery = true
					part.CollisionFidelity = Enum.CollisionFidelity.Hull
				end
				if string.find(part.Name, "_alpha") then
					part.CastShadow = false
				end
			elseif part:IsA("BasePart") then
				part.Anchored = true
			end
		end

		model:PivotTo(CFrame.new())
		model.Parent = info.kind == "Rooms" and roomsFolder or propsFolder
	end

	local count = { Rooms = 0, Props = 0 }
	local candidates = {}
	for _, container in { workspace, roomsFolder, propsFolder } do
		for _, child in container:GetChildren() do
			if child:IsA("Model") and expected[child.Name] then
				table.insert(candidates, child)
			end
		end
	end

	print(`SCP : préparation de {#candidates} modèles…`)
	for _, model in candidates do
		local info = expected[model.Name]
		local ok, err = pcall(prepare, model, info)
		if ok then
			count[info.kind] += 1
		else
			warn(`  {model.Name} : {err}`)
		end
	end

	local missing = {}
	for name, info in expected do
		local f = info.kind == "Rooms" and roomsFolder or propsFolder
		if not f:FindFirstChild(name) then
			table.insert(missing, `{info.kind}/{name}`)
		end
	end
	table.sort(missing)
	print(`SCP : {count.Rooms} salles et {count.Props} props préparés.`)
	if #missing > 0 then
		local shown = table.concat(missing, ", ", 1, math.min(#missing, 12))
		print(`SCP : encore {#missing} à importer : {shown}{if #missing > 12 then ", …" else ""}`)
	else
		print("SCP : tout est importé !")
	end

	return count
end
