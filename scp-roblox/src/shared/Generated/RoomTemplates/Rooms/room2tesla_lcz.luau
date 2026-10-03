--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2tesla_lcz",
	description = "Hallway with a tesla gate. LCZ variant.",
	shape = "2",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2tesla_lcz",
	boundsMin = { -7.6, -1.6, -25.6 },
	boundsMax = { 7.6, 17.8708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 6.4, 8.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 6.4, 12.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 6.4, 4.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 8.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 12.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 4.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, 6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, -18.3 },
		{ 0, 1.65, -7.9 },
		{ 0, 1.65, 7.3 },
		{ 0, 1.65, 17.7 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
