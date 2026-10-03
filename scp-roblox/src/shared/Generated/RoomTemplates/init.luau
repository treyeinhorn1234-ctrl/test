--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.
-- Données extraites de SCP - Containment Breach (Regalis11/scpcb), CC BY-SA 3.0.
-- Positions en studs, dans le repère local de chaque salle (main droite, Y vers le haut).

local data = {
	scale = 0.025,
	ambience = { "SFX\\Ambient\\Room ambience\\rumble.ogg", "SFX\\Ambient\\Room ambience\\lowdrone.ogg", "SFX\\Ambient\\Room ambience\\pulsing.ogg", "SFX\\Ambient\\Room ambience\\ventilation.ogg", "SFX\\Ambient\\Room ambience\\drip.ogg", "SFX\\Alarm\\Alarm.ogg", "SFX\\Ambient\\Room ambience\\895.ogg", "SFX\\Ambient\\Room ambience\\fuelpump.ogg", "SFX\\Ambient\\Room ambience\\Fan.ogg", "SFX\\Ambient\\Room ambience\\servers1.ogg" },
	props = {
		["205"] = {
			boundsMin = { -0.0089, -0.0001, -0.0123 },
			boundsMax = { 0.0089, 0.0636, 0.079 },
		},
		boxfile_a = {
			boundsMin = { -0.0556, 0, -0.1763 },
			boundsMax = { 0.0556, 0.458, 0.1763 },
		},
		boxfile_b = {
			boundsMin = { -0.0556, 0, -0.1763 },
			boundsMax = { 0.0556, 0.458, 0.1763 },
		},
		cabinet_a = {
			boundsMin = { -0.3151, 0, -0.2987 },
			boundsMax = { 0.3151, 1.3342, 0.2987 },
		},
		cabinet_b = {
			boundsMin = { -1.2606, 0, -0.2987 },
			boundsMax = { 1.2606, 1.3342, 0.2987 },
		},
		contdoorframe = {
			boundsMin = { -0.1997, -0.0003, -0.0419 },
			boundsMax = { 0.1997, 0.1879, 0.0419 },
		},
		crate1 = {
			boundsMin = { -0.4954, 0.0007, -0.3514 },
			boundsMax = { 0.5156, 0.6397, 0.3566 },
		},
		crate2 = {
			boundsMin = { -0.4319, 0, -0.2337 },
			boundsMax = { 0.4357, 0.2385, 0.232 },
		},
		crate3 = {
			boundsMin = { -0.7173, -0.0011, -0.2239 },
			boundsMax = { 0.7173, 0.1479, 0.2197 },
		},
		elecbox = {
			boundsMin = { -0.109, -0.0142, -0.026 },
			boundsMax = { 0.1376, 0.2925, 0.1017 },
		},
		keyboard = {
			boundsMin = { -0.4875, 0, -0.2364 },
			boundsMax = { 0.4876, 0.0905, 0.1986 },
		},
		lamp1 = {
			boundsMin = { -0.3488, 0, -2.1087 },
			boundsMax = { 0.3488, 3.0275, 0.338 },
		},
		lamp2 = {
			boundsMin = { -0.908, -0.0096, -0.9287 },
			boundsMax = { 0.9057, 3.3213, 0.9316 },
		},
		monitor = {
			boundsMin = { -0.5285, -0.0003, -0.1451 },
			boundsMax = { 0.5414, 0.9846, 0.1659 },
		},
		officeseat_a = {
			boundsMin = { -0.3066, 0, -0.3051 },
			boundsMax = { 0.3066, 1.1613, 0.3051 },
		},
		tank1 = {
			boundsMin = { -0.6908, -0.0003, -0.7054 },
			boundsMax = { 0.6908, 3.9061, 0.7117 },
		},
		tank2 = {
			boundsMin = { -0.713, 0, -2.0916 },
			boundsMax = { 0.713, 1.4627, 2.0916 },
		},
	},
}

data.rooms = {}
for _, module in script.Rooms:GetChildren() do
	local room = require(module)
	data.rooms[room.name] = room
end

return data
