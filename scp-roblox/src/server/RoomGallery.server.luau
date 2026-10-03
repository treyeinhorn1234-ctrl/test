--!strict
-- Galerie de test : affiche côte à côte toutes les salles déjà importées, pour vérifier
-- la conversion dans Studio. Activée seulement si Workspace a l'attribut SCP_RoomGallery = true.

local Players = game:GetService("Players")

local RoomBuilder = require(script.Parent.RoomBuilder)

if workspace:GetAttribute("SCP_RoomGallery") ~= true then
	return
end

local MARGIN = 20 -- studs entre deux salles
local ROW_WIDTH = 900 -- on passe à la rangée suivante au-delà

local gallery = Instance.new("Folder")
gallery.Name = "RoomGallery"
gallery.Parent = workspace

local function label(text: string, cf: CFrame)
	local part = Instance.new("Part")
	part.Name = "Label"
	part.Anchored = true
	part.CanCollide = false
	part.Transparency = 1
	part.Size = Vector3.one
	part.CFrame = cf
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(240, 40)
	gui.AlwaysOnTop = true
	gui.MaxDistance = 150
	local tl = Instance.new("TextLabel")
	tl.Size = UDim2.fromScale(1, 1)
	tl.BackgroundTransparency = 0.3
	tl.BackgroundColor3 = Color3.new(0, 0, 0)
	tl.TextColor3 = Color3.new(1, 1, 1)
	tl.TextScaled = true
	tl.Text = text
	tl.Parent = gui
	gui.Parent = part
	part.Parent = gallery
end

-- Rangement en étagères : certaines salles (extérieurs, salle de 173) sont bien plus grandes que la grille
local built = 0
local firstSpawn: CFrame? = nil
local cursorX, cursorZ, rowDepth = 0, 0, 0
for _, name in RoomBuilder.listTemplates() do
	local template = RoomBuilder.getTemplate(name)
	if template and RoomBuilder.hasAsset(name) then
		local lo, hi = template.boundsMin, template.boundsMax
		local width, depth = hi[1] - lo[1], hi[3] - lo[3]
		if cursorX > 0 and cursorX + width > ROW_WIDTH then
			cursorX, cursorZ, rowDepth = 0, cursorZ + rowDepth + MARGIN, 0
		end
		-- Décale pour que le coin de la boîte englobante tombe sur le curseur
		local cf = CFrame.new(cursorX - lo[1], 0, cursorZ - lo[3])
		cursorX += width + MARGIN
		rowDepth = math.max(rowDepth, depth)
		local ok, err = pcall(RoomBuilder.build, name, cf, gallery)
		if ok then
			label(name, cf * CFrame.new(0, hi[2] + 5, 0))
			firstSpawn = firstSpawn or cf * CFrame.new(0, 5, 0)
			built += 1
		else
			warn(`Galerie : {name} : {err}`)
		end
	end
end
print(`Galerie : {built} salles construites.`)

local spawnCf = firstSpawn
if spawnCf then
	local function place(player: Player)
		player.CharacterAdded:Connect(function(character)
			task.wait()
			character:PivotTo(spawnCf)
		end)
	end
	Players.PlayerAdded:Connect(place)
	for _, player in Players:GetPlayers() do
		place(player)
	end
end
