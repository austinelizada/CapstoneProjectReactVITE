import { Menu } from "lucide-react";

function Navbar({ toggleSidebar }) {
  return (
    <header className="bg-white shadow px-6 py-4 flex items-center justify-between">

      <div className="flex items-center gap-4">

        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <Menu size={24} />
        </button>

        <div>
          <h1 className="text-xl font-bold">
            Dashboard
          </h1>

          <p className="text-sm text-gray-500">
            Welcome Administrator
          </p>
        </div>

      </div>

      <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
        A
      </div>

    </header>
  );
}

export default Navbar;