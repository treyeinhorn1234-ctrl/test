--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "pocketdimension",
	description = "SCP-106's pocket dimension. Placed automatically in all maps.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = {},
	asset = "pocketdimension",
	boundsMin = { -12.8, -0.8, -12.8 },
	boundsMax = { 12.8, 25.6, 12.8 },
	parts = {
		rockmoss = { 0, 12.4, 0, 25.6, 26.4, 25.6 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 23.2, 0 },
			range = 30,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
	},
	spotlights = {},
	waypoints = {},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
