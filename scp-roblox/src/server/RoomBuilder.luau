--!strict
-- Reconstruit une salle de SCP - Containment Breach à partir des modèles importés
-- dans ServerStorage.SCPAssets et des données générées (Generated/RoomTemplates).
--
-- Arborescence attendue (créée par tools/studio/PrepareAssets.luau) :
--   ServerStorage.SCPAssets.Rooms.<salle>   (Model)
--   ServerStorage.SCPAssets.Props.<prop>    (Model)

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

export type Light = { position: { number }, range: number, color: { number }, brightness: number }
export type SpotLight = Light & { direction: { number }, innerCone: number, outerCone: number }
export type Prop = { model: string, file: string, position: { number }, rotation: { number }, scale: { number } }
export type RoomTemplate = {
	name: string,
	description: string,
	shape: string, -- "1", "2", "2C", "3" ou "4" (nombre de sorties ; C = en coin)
	commonness: number,
	large: boolean,
	disableDecals: boolean,
	zones: { number },
	asset: string,
	boundsMin: { number },
	boundsMax: { number },
	parts: { [string]: { number } }, -- MeshPart -> centre x, y, z, taille x, y, z (repère du fichier)
	triggerBoxes: { { name: string, min: { number }, max: { number } } },
	lights: { Light },
	spotlights: { SpotLight },
	waypoints: { { number } },
	sounds: { { position: { number }, ambience: number, range: number } },
	screens: { { position: { number }, image: string } },
	props: { Prop },
	playerStarts: { { position: { number }, angles: { number } } },
}

local RoomTemplates: {
	scale: number,
	ambience: { string },
	props: { [string]: { boundsMin: { number }, boundsMax: { number }, parts: { [string]: { number } } } },
	rooms: { [string]: RoomTemplate },
} = require(ReplicatedStorage.Shared.Generated.RoomTemplates) :: any

local RoomBuilder = {}

-- Une salle fait 2048 unités Blitz3D de côté ; c'est aussi le pas de la grille de la carte.
RoomBuilder.GRID_SIZE = 2048 * RoomTemplates.scale

-- Les lumières de Roblox sont limitées à 60 studs de portée.
local MAX_LIGHT_RANGE = 60

local collidersFolder = script.Parent.Generated.RoomColliders

local function assetsFolder(kind: string): Folder?
	local root = ServerStorage:FindFirstChild("SCPAssets")
	return if root then root:FindFirstChild(kind) :: Folder? else nil
end

function RoomBuilder.getTemplate(name: string): RoomTemplate?
	return RoomTemplates.rooms[name]
end

function RoomBuilder.listTemplates(): { string }
	local names = {}
	for name in RoomTemplates.rooms do
		table.insert(names, name)
	end
	table.sort(names)
	return names
end

function RoomBuilder.hasAsset(name: string): boolean
	local template = RoomBuilder.getTemplate(name)
	local rooms = assetsFolder("Rooms")
	return template ~= nil and rooms ~= nil and rooms:FindFirstChild(template.asset) ~= nil
end

local function toColor(rgb: { number }): Color3
	return Color3.fromRGB(rgb[1], rgb[2], rgb[3])
end

local function toVector(v: { number }): Vector3
	return Vector3.new(v[1], v[2], v[3])
end

-- Mise à l'échelle non uniforme d'un modèle autour de son pivot.
local function scaleModel(model: Model, scale: Vector3)
	if scale == Vector3.one then
		return
	end
	if math.abs(scale.X - scale.Y) < 1e-4 and math.abs(scale.Y - scale.Z) < 1e-4 then
		model:ScaleTo(model:GetScale() * scale.X)
		return
	end
	local pivot = model:GetPivot()
	for _, part in model:GetDescendants() do
		if part:IsA("BasePart") then
			local localCf = pivot:ToObjectSpace(part.CFrame)
			-- Approximation : les props du jeu ne sont tournés qu'autour de leurs propres axes
			part.Size *= scale
			part.CFrame = pivot * (CFrame.new(localCf.Position * scale) * localCf.Rotation)
		end
	end
end

local function addProps(room: Model, template: RoomTemplate, roomCFrame: CFrame)
	local props = assetsFolder("Props")
	if not props then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "Props"
	for _, p in template.props do
		local source = props:FindFirstChild(p.model) :: Model?
		if source then
			local prop = source:Clone()
			local r = p.rotation
			local cf = CFrame.new(p.position[1], p.position[2], p.position[3], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9])
			prop:PivotTo(roomCFrame * cf)
			scaleModel(prop, toVector(p.scale))
			prop.Parent = folder
		end
	end
	folder.Parent = room
end

local function addLights(room: Model, template: RoomTemplate, roomCFrame: CFrame)
	if #template.lights == 0 and #template.spotlights == 0 then
		return
	end
	local anchor = Instance.new("Part")
	anchor.Name = "Lights"
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.CastShadow = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.CFrame = roomCFrame

	for i, l in template.lights do
		local att = Instance.new("Attachment")
		att.Name = "Light" .. i
		att.Position = toVector(l.position)
		local light = Instance.new("PointLight")
		light.Range = math.min(l.range, MAX_LIGHT_RANGE)
		light.Brightness = l.brightness
		light.Color = toColor(l.color)
		light.Shadows = true
		light.Parent = att
		att.Parent = anchor
	end

	for i, s in template.spotlights do
		local att = Instance.new("Attachment")
		att.Name = "Spot" .. i
		local pos = toVector(s.position)
		att.CFrame = CFrame.lookAt(pos, pos + toVector(s.direction))
		local light = Instance.new("SpotLight")
		light.Face = Enum.NormalId.Front
		light.Range = math.min(s.range, MAX_LIGHT_RANGE)
		light.Brightness = s.brightness
		light.Color = toColor(s.color)
		light.Angle = math.clamp(s.outerCone, 0, 180)
		light.Shadows = true
		light.Parent = att
		att.Parent = anchor
	end

	anchor.Parent = room
end

local function newCollider(): Part
	local part = Instance.new("Part")
	part.Anchored = true
	part.CanCollide = true
	part.CanQuery = true -- les SCP s'en servent pour les lignes de vue
	part.CanTouch = false
	part.CastShadow = false
	part.Transparency = 1
	part.Material = Enum.Material.SmoothPlastic
	return part
end

-- Boîtes de collision générées (les maillages visibles, eux, ne collisionnent pas).
local function addColliders(room: Model, template: RoomTemplate, roomCFrame: CFrame)
	local source = collidersFolder:FindFirstChild(template.asset)
	if not source then
		warn(`Pas de collisions générées pour {template.name}`)
		return
	end
	local folder = Instance.new("Model")
	folder.Name = "Colliders"
	local proto = newCollider()

	-- Les données sont découpées en plusieurs modules pour rester de taille raisonnable
	for _, chunk in source:GetChildren() do
		if not chunk:IsA("ModuleScript") then
			continue
		end
		local data: { aligned: { number }, rotated: { number } } = require(chunk) :: any
		local a = data.aligned
		for i = 1, #a, 6 do
			local part = proto:Clone()
			part.Size = Vector3.new(a[i + 3], a[i + 4], a[i + 5])
			part.CFrame = roomCFrame * CFrame.new(a[i], a[i + 1], a[i + 2])
			part.Parent = folder
		end
		local r = data.rotated
		for i = 1, #r, 15 do
			local part = proto:Clone()
			part.Size = Vector3.new(r[i + 3], r[i + 4], r[i + 5])
			part.CFrame = roomCFrame
				* CFrame.new(r[i], r[i + 1], r[i + 2], r[i + 6], r[i + 7], r[i + 8], r[i + 9], r[i + 10], r[i + 11], r[i + 12], r[i + 13], r[i + 14])
			part.Parent = folder
		end
	end
	proto:Destroy()
	folder.Parent = room
end

-- Les maillages visibles servent seulement à l'affichage : la collision passe par les boîtes.
local function setVisualOnly(room: Model)
	for _, part in room:GetDescendants() do
		if part:IsA("BasePart") then
			part.Anchored = true
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
		end
	end
end

-- Construit la salle `name` à l'emplacement `roomCFrame` (origine de la salle,
-- c'est-à-dire le centre de la case de grille, au niveau du sol).
function RoomBuilder.build(name: string, roomCFrame: CFrame, parent: Instance?): Model
	local template = RoomBuilder.getTemplate(name)
	assert(template, `Salle inconnue : {name}`)
	local rooms = assetsFolder("Rooms")
	local source = rooms and rooms:FindFirstChild(template.asset) :: Model?
	assert(source, `Modèle de salle non importé : ServerStorage.SCPAssets.Rooms.{template.asset}`)

	local room = source:Clone()
	room.Name = name
	room:PivotTo(roomCFrame)
	setVisualOnly(room)
	addColliders(room, template, roomCFrame)
	addProps(room, template, roomCFrame)
	addLights(room, template, roomCFrame)
	room:SetAttribute("RoomTemplate", name)
	room:SetAttribute("Shape", template.shape)
	room.Parent = parent or workspace
	return room
end

return RoomBuilder
