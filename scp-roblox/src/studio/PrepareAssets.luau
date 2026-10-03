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
--   3. retrouve comment l'importateur a tourné le modèle, en comparant la position de chaque
--      MeshPart à celle attendue, puis place le pivot sur l'origine de la salle ou du prop ;
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
		expected[room.asset] = { kind = "Rooms", min = room.boundsMin, max = room.boundsMax, parts = room.parts }
	end
	for name, prop in data.props do
		expected[name] = { kind = "Props", min = prop.boundsMin, max = prop.boundsMax, parts = prop.parts }
	end

	-- Les 48 matrices de permutation signées : 24 rotations et 24 symétries (miroirs).
	-- Chacune envoie v sur (s1 * v[p1], s2 * v[p2], s3 * v[p3]).
	local orientations = {}
	for _, perm in { { 1, 2, 3 }, { 2, 3, 1 }, { 3, 1, 2 }, { 1, 3, 2 }, { 3, 2, 1 }, { 2, 1, 3 } } do
		local permSign = if perm[1] == 1 and perm[2] == 2 or perm[1] == 2 and perm[2] == 3 or perm[1] == 3 and perm[2] == 1
			then 1
			else -1
		for _, s1 in { 1, -1 } do
			for _, s2 in { 1, -1 } do
				for _, s3 in { 1, -1 } do
					table.insert(orientations, { perm = perm, signs = { s1, s2, s3 }, proper = permSign * s1 * s2 * s3 == 1 })
				end
			end
		end
	end
	-- L'identité en premier : à égalité, on garde le modèle tel quel
	table.sort(orientations, function(a, b)
		local ida = a.perm[1] == 1 and a.perm[2] == 2 and a.signs[1] + a.signs[2] + a.signs[3] == 3
		local idb = b.perm[1] == 1 and b.perm[2] == 2 and b.signs[1] + b.signs[2] + b.signs[3] == 3
		return ida and not idb
	end)

	local function apply(o, v: { number }): Vector3
		return Vector3.new(o.signs[1] * v[o.perm[1]], o.signs[2] * v[o.perm[2]], o.signs[3] * v[o.perm[3]])
	end

	local function toCFrame(o, t: Vector3): CFrame
		local m = { { 0, 0, 0 }, { 0, 0, 0 }, { 0, 0, 0 } }
		for i = 1, 3 do
			m[i][o.perm[i]] = o.signs[i]
		end
		return CFrame.new(t.X, t.Y, t.Z, m[1][1], m[1][2], m[1][3], m[2][1], m[2][2], m[2][3], m[3][1], m[3][2], m[3][3])
	end

	local function describe(o): string
		local axes = { "X", "Y", "Z" }
		local out = {}
		for i = 1, 3 do
			table.insert(out, (if o.signs[i] < 0 then "-" else "") .. axes[o.perm[i]])
		end
		return table.concat(out, " ")
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

	local function partBounds(part: BasePart): (Vector3, Vector3)
		local lo = Vector3.new(math.huge, math.huge, math.huge)
		local hi = -lo
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

		-- Paires (centre attendu dans le fichier, centre mesuré dans Studio), par nom de MeshPart
		local pairs_ = {}
		local seen = {}
		for _, part in model:GetDescendants() do
			if part:IsA("BasePart") then
				local e = info.parts and info.parts[part.Name]
				if e then
					local plo, phi = partBounds(part)
					table.insert(pairs_, { e = e, center = (plo + phi) / 2, size = phi - plo })
				elseif #seen < 5 then
					table.insert(seen, part.Name)
				end
			end
		end

		-- Pour chaque orientation possible : translation moyenne, puis écart restant
		local best, bestT, bestErr = nil, nil, math.huge
		local mirror, mirrorErr = nil, math.huge
		if #pairs_ > 0 then
			for _, o in orientations do
				local sum = Vector3.zero
				for _, p in pairs_ do
					sum += p.center - apply(o, p.e)
				end
				local t = sum / #pairs_
				local err = 0
				for _, p in pairs_ do
					err += (p.center - (apply(o, p.e) + t)).Magnitude
					local s = apply(o, { p.e[4], p.e[5], p.e[6] })
					err += (Vector3.new(math.abs(s.X), math.abs(s.Y), math.abs(s.Z)) - p.size).Magnitude
				end
				err /= #pairs_
				if o.proper and err < bestErr - 1e-3 then
					best, bestT, bestErr = o, t, err
				elseif not o.proper and err < mirrorErr - 1e-3 then
					mirror, mirrorErr = o, err
				end
			end
		end

		if best then
			model.WorldPivot = toCFrame(best, bestT)
			local orientation = describe(best)
			if orientation ~= "X Y Z" then
				print(`  {model.Name} : rotation de l'importateur corrigée (axes {orientation})`)
			end
			if mirror and mirrorErr < bestErr * 0.5 and bestErr > 0.1 then
				warn(`  {model.Name} : le modèle importé semble en miroir ({describe(mirror)}). Envoie ce message au développeur.`)
			elseif bestErr > 0.5 then
				warn(`  {model.Name} : calage approximatif (écart moyen {string.format("%.2f", bestErr)} studs). Envoie ce message au développeur.`)
			end
		else
			-- Noms de MeshParts inconnus : on se rabat sur la boîte englobante, sans pouvoir
			-- détecter une rotation de l'importateur
			if seen[1] == "default" then
				warn(`  {model.Name} : importé en un seul morceau (« default »). Supprime-le, retélécharge les modèles (nouvelle version) et réimporte ce .obj.`)
			else
				warn(`  {model.Name} : MeshParts non reconnues ({table.concat(seen, ", ")}), calage par boîte englobante.`)
			end
			model.WorldPivot = CFrame.new((lo + hi) / 2 - (expMin + expMax) / 2)
		end

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
				-- Pas de version simplifiée à distance : elle déforme les murs fins
				part.RenderFidelity = Enum.RenderFidelity.Precise
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
